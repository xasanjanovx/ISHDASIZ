/** @jest-environment node */
import {createClient} from '@supabase/supabase-js';
import {NextRequest} from 'next/server';
import {readChannelSnapshot,removeChannelMessage,CHANNEL_REDACTED_TEXT} from '@/lib/telegram/channel-state';
import {reconcileChannelEntity} from '@/lib/telegram/channel-worker';
import {buildResumeChannelMessage,hashMessage} from '@/lib/telegram/channel-sync';
import {GET as runWorker} from '@/app/api/cron/sync-telegram-channels/route';
import {GET as seedQueue} from '@/app/api/maintenance/channel-sync-seed/route';
import {GET as listDeliveries,POST as resolveDelivery} from '@/app/api/maintenance/channel-deliveries/route';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
jest.mock('@/lib/telegram/telegram-api',()=>({callTelegramAPI:jest.fn(),sendChannelMessage:jest.fn(),editMessage:jest.fn()}));
const actualCreate=jest.requireActual('@supabase/supabase-js').createClient;
const R='10000000-0000-4000-8000-000000000001',P='20000000-0000-4000-8000-000000000001',E='30000000-0000-4000-8000-000000000001';
const T='30000000-0000-4000-8000-000000000002',I='40000000-0000-4000-8000-000000000001';
const channel='@ishdasiz_andijon',event={id:E,lease_token:T,entity_type:'resume' as const,entity_id:R};
const snapshot=(patch:any={})=>({available:true,entity:{id:R,title:'Synthetic CV',full_name:'Public name',phone:'+998901111111',is_public:true,status:'active',found_job:false,post_to_channel:true,channel_account_open:true},region_slug:'andijon-viloyati',...patch});
const hidden={available:false,entity:null,region_slug:null};
const post=(patch:any={})=>({id:P,channel_username:channel,message_id:10,message_hash:'old',status:'active',...patch});
function reader(replies:any[]){const requests:any[]=[];const client=actualCreate('https://example.supabase.co','synthetic-test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input:any,init:any)=>{const req={url:new URL(String(input)),method:init?.method,body:init?.body?JSON.parse(init.body):null};requests.push(req);const next=replies.shift();expect(next).not.toBeUndefined();const reply=typeof next==='function'?next(req):next;return new Response(JSON.stringify(reply?.error||reply),{status:reply?.error?500:200,headers:{'Content-Type':'application/json'}});}}});return{client,requests};}
function transport(){return{call:jest.fn().mockResolvedValue(true),send:jest.fn().mockResolvedValue({message_id:11}),edit:jest.fn().mockResolvedValue({message_id:10})};}
const request=(url='http://localhost/api/cron/sync-telegram-channels',authorized=true)=>new NextRequest(url,{headers:authorized?{authorization:'Bearer synthetic-cron-secret'}:{}});
beforeEach(()=>{jest.clearAllMocks();process.env.CRON_SECRET='synthetic-cron-secret';process.env.TELEGRAM_BOT_TOKEN='synthetic-bot-token';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';delete process.env.TELEGRAM_DRY_RUN;});
test('snapshots fail closed on missing schema, malformed visibility proof and mismatched IDs without table fallbacks',async()=>{
 for(const reply of [{error:{code:'PGRST202'}},{available:true,entity:null,region_slug:null},snapshot({entity:{id:R}}),snapshot({entity:{id:P,channel_account_open:true}})]){const h=reader([reply]);await expect(readChannelSnapshot(h.client,'resume',R)).rejects.toThrow();expect(h.requests).toHaveLength(1);expect(h.requests[0].url.pathname).toBe('/rest/v1/rpc/ishdasiz_channel_snapshot');}
});
test('hidden or deleted entities remove their known posts and only then persist confirmed deletion',async()=>{
 const h=reader([hidden,[post()],true]),t=transport(),guard=jest.fn().mockResolvedValue(undefined);const result=await reconcileChannelEntity(h.client,event,t,guard);expect(result).toMatchObject({deleted:1,sent:0,redacted:0});expect(t.call).toHaveBeenCalledWith('deleteMessage',{chat_id:channel,message_id:10});expect(h.requests[2].body.p_status).toBe('deleted');expect(h.requests[2].body.p_receipt).toBe(P);expect(h.requests[2].body.p_token).toBe(T);expect(t.send).not.toHaveBeenCalled();
});
test('a rejected deletion never changes the post status or claims successful cleanup',async()=>{
 const h=reader([hidden,[post()]]),t=transport();t.call.mockRejectedValue(new Error('Forbidden: bot is not a member'));await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow('Forbidden');expect(h.requests).toHaveLength(2);expect(t.edit).not.toHaveBeenCalled();
});
test('old messages that cannot be deleted are redacted without contacts or inline actions',async()=>{
 const h=reader([hidden,[post()],true]),t=transport();t.call.mockRejectedValueOnce(new Error("Bad Request: message can't be deleted")).mockResolvedValueOnce({message_id:10});const result=await reconcileChannelEntity(h.client,event,t,async()=>{});expect(result.redacted).toBe(1);expect(result.deleted).toBe(0);expect(t.call.mock.calls[1]).toEqual(['editMessageText',{chat_id:channel,message_id:10,text:CHANNEL_REDACTED_TEXT,reply_markup:{inline_keyboard:[]}}]);expect(h.requests[2].body.p_status).toBe('redacted');
});
test('failed redaction and unconfirmed Telegram results remain retryable failures',async()=>{
 for(const replies of [[false],[new Error("message can't be deleted"),new Error("message can't be edited")],[new Error("message can't be deleted"),false]]){const call=jest.fn();for(const reply of replies)reply instanceof Error?call.mockRejectedValueOnce(reply):call.mockResolvedValueOnce(reply);await expect(removeChannelMessage(call,channel,10)).rejects.toThrow();}
});
test('only a missing message is an idempotent removal, never a missing chat or a permission error',async()=>{
 expect(await removeChannelMessage(jest.fn().mockRejectedValue(new Error('Bad Request: message to delete not found')),channel,10)).toBe('deleted');await expect(removeChannelMessage(jest.fn().mockRejectedValue(new Error('Bad Request: chat not found')),channel,10)).rejects.toThrow('chat not found');
});
test('a legacy receipt cannot authorize deleting a post in an unrelated Telegram channel',async()=>{
 const call=jest.fn();await expect(removeChannelMessage(call,'@unrelated_channel',10)).rejects.toThrow('not configured');expect(call).not.toHaveBeenCalled();
});
test('publication uses current state even for an old deactivate event and requires a saved message receipt',async()=>{
 const h=reader([snapshot(),[],snapshot(),I,post({message_id:11}),snapshot()]),t=transport();const result=await reconcileChannelEntity(h.client,{...event,action:'deactivate'} as any,t,async()=>{});expect(result.sent).toBe(1);expect(h.requests[3].body).toMatchObject({p_token:T,p_event:E,p_channel:channel});expect(h.requests[4].body).toMatchObject({p_intent:I,p_outcome:'confirmed',p_message:11});expect(t.send).toHaveBeenCalledTimes(1);
});
test('a matching receipt skips duplicate sends while harmless view updates do not invalidate the snapshot',async()=>{
 const first=snapshot(),hash=hashMessage(buildResumeChannelMessage(first.entity,first.region_slug)),latest=snapshot({entity:{...first.entity,views_count:99,updated_at:'2099-01-01'}});const h=reader([first,[post({message_hash:hash})],latest]),t=transport();expect((await reconcileChannelEntity(h.client,event,t,async()=>{})).skipped).toBe(1);expect(t.send).not.toHaveBeenCalled();expect(t.edit).not.toHaveBeenCalled();
});
test.each([hidden,snapshot({region_slug:'toshkent-shahri'}),snapshot({entity:{...snapshot().entity,phone:'+998902222222'}})])('publication changes between reads stop a send: %p',async latest=>{
 const h=reader([snapshot(),[],latest]),t=transport();await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow('changed');expect(t.send).not.toHaveBeenCalled();
});
test('a different region is removed first and a removal failure prevents a second regional publication',async()=>{
 const h=reader([snapshot(),[post({channel_username:'@ishdasiz_toshkent'})]]),t=transport();t.call.mockRejectedValue(new Error('Telegram connection failed'));await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow();expect(t.send).not.toHaveBeenCalled();expect(h.requests).toHaveLength(2);
});
test('unconfirmed sends and failed receipt storage require review and never claim a successful delivery',async()=>{
 const invalid=reader([snapshot(),[],snapshot(),I,{recorded:true}]),t=transport();t.send.mockResolvedValue({});await expect(reconcileChannelEntity(invalid.client,event,t,async()=>{})).rejects.toThrow('operator review');expect(invalid.requests[4].body.p_outcome).toBe('uncertain');
 const failed=reader([snapshot(),[],snapshot(),I,{error:{code:'08006'}}]);await expect(reconcileChannelEntity(failed.client,event,transport(),async()=>{})).rejects.toThrow('operator review');expect(failed.requests[4].body).toMatchObject({p_message:11,p_outcome:'confirmed'});
});

test('edit errors do not create duplicate posts; unchanged text saves the current hash as an idempotent success',async()=>{
 const failed=reader([snapshot(),[post()],snapshot()]),t=transport();t.edit.mockRejectedValue(new Error("message can't be edited"));await expect(reconcileChannelEntity(failed.client,event,t,async()=>{})).rejects.toThrow();expect(t.send).not.toHaveBeenCalled();
 const same=reader([snapshot(),[post()],snapshot(),snapshot(),true]),u=transport();u.edit.mockRejectedValue(new Error('message is not modified'));expect((await reconcileChannelEntity(same.client,event,u,async()=>{})).skipped).toBe(1);expect(u.send).not.toHaveBeenCalled();
});
test('a stale worker guard stops every external mutation before Telegram is called',async()=>{
 const h=reader([snapshot(),[],snapshot()]),t=transport();await expect(reconcileChannelEntity(h.client,event,t,async()=>{throw new Error('Lease expired');})).rejects.toThrow('Lease expired');expect(t.send).not.toHaveBeenCalled();
});
test('failed removal receipt storage remains a failed queue operation',async()=>{
 const h=reader([hidden,[post()],{error:{code:'40001'}}]);await expect(reconcileChannelEntity(h.client,event,transport(),async()=>{})).rejects.toThrow('not recorded');
});
test('maintenance and worker require a configured secret in every environment before creating a client',async()=>{
 expect((await runWorker(request(undefined,false))).status).toBe(401);expect((await seedQueue(request('http://localhost/api/maintenance/channel-sync-seed',false))).status).toBe(401);delete process.env.CRON_SECRET;expect((await seedQueue(request())).status).toBe(401);expect(createClient).not.toHaveBeenCalled();
});
test('busy or missing leases never run or release someone else’s worker',async()=>{
 const h=reader([false]);(createClient as jest.Mock).mockReturnValue(h.client);expect(await (await runWorker(request())).json()).toMatchObject({running:true});expect(h.requests).toHaveLength(1);expect(h.requests[0].body.p_action).toBe('acquire');
 const unavailable=reader([{error:{code:'PGRST202'}}]);(createClient as jest.Mock).mockReturnValue(unavailable.client);expect((await runWorker(request())).status).toBe(503);expect(unavailable.requests).toHaveLength(1);
});
test('dry-run mode cannot acknowledge simulated Telegram delivery in a real queue',async()=>{
 process.env.TELEGRAM_DRY_RUN='1';expect((await runWorker(request())).status).toBe(409);expect(createClient).not.toHaveBeenCalled();
});
test('an empty queue releases only its own token and reports zero processing',async()=>{
 const h=reader([true,true,null,0,true]);(createClient as jest.Mock).mockReturnValue(h.client);expect(await (await runWorker(request())).json()).toMatchObject({success:true,processed:0});const token=h.requests[0].body.p_token;expect(h.requests.at(-1).body).toEqual({p_token:token,p_action:'release'});
});
test('a failed claim or done write is never counted as success',async()=>{
 const h=reader([true,true,{error:{code:'08006'}},true]);(createClient as jest.Mock).mockReturnValue(h.client);expect((await runWorker(request())).status).toBe(503);expect(h.requests.at(-1).body.p_action).toBe('release');
});
test('a failed done acknowledgement is recorded as failure and never increases the done count',async()=>{
 const h=reader([true,true,(req:any)=>({id:E,entity_id:R,entity_type:'resume',status:'processing',attempts:1,lease_token:req.body.p_token}),hidden,[],{error:{code:'08006'}},true,true,null,0,true]);
 (createClient as jest.Mock).mockReturnValue(h.client);expect(await (await runWorker(request())).json()).toMatchObject({success:false,processed:1,done:0,failed:1});
 expect(h.requests.filter(r=>r.url.pathname.includes('channel_finish')).map(r=>r.body.p_success)).toEqual([true,false]);
});
test('seed uses the server aggregate with a validated keyset cursor and never reads private rows in the route',async()=>{
 const h=reader([{scanned:200,jobs:190,resumes:10,after_type:'resume',after_id:R,has_more:true}]);(createClient as jest.Mock).mockReturnValue(h.client);const response=await seedQueue(request('http://localhost/api/maintenance/channel-sync-seed?entity=all&limit=200&after_type=job&after_id='+P));expect(await response.json()).toMatchObject({inserted:{total:200},nextCursor:{type:'resume',id:R}});expect(h.requests).toHaveLength(1);expect(h.requests[0].body).toEqual({p_type:'all',p_limit:200,p_after_type:'job',p_after_id:P});
});
test.each(['limit=0','limit=5001','entity=foreign','after_type=job','after_type=resume&after_id=injected'])('invalid seed input is rejected before database access: %s',async query=>{
 expect((await seedQueue(request('http://localhost/api/maintenance/channel-sync-seed?'+query))).status).toBe(400);expect(createClient).not.toHaveBeenCalled();
});

test('an ambiguous send result is durably marked and a blocked reservation cannot send again',async()=>{
 const h=reader([snapshot(),[],snapshot(),I,{recorded:true},snapshot(),[],snapshot(),{error:{code:'55000'}}]),t=transport();t.send.mockRejectedValue(new Error('connection lost after request'));
 await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow('operator review');await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow('operator review');expect(t.send).toHaveBeenCalledTimes(1);expect(h.requests[4].body.p_outcome).toBe('uncertain');
});
test('no Telegram send occurs without a confirmed durable reservation',async()=>{
 const h=reader([snapshot(),[],snapshot(),{error:{code:'PGRST202'}}]),t=transport();await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow('reservation');expect(t.send).not.toHaveBeenCalled();
});
test('an explicit Telegram rejection is recorded as retryable rather than an ambiguous delivery',async()=>{
 const h=reader([snapshot(),[],snapshot(),I,{recorded:true}]),t=transport();t.send.mockRejectedValue(Object.assign(new Error('Bad Request'),{definitiveRejection:true}));await expect(reconcileChannelEntity(h.client,event,t,async()=>{})).rejects.toThrow('rejected');expect(h.requests[4].body.p_outcome).toBe('rejected');
});
test('a known message ID is saved before checking a lease or a post-send privacy change',async()=>{
 const h=reader([snapshot(),[],snapshot(),I,post({message_id:11}),hidden,true]),t=transport();const result=await reconcileChannelEntity(h.client,event,t,async()=>{});expect(result).toMatchObject({sent:1,deleted:1});expect(h.requests[4].url.pathname).toContain('channel_send_result');expect(t.call).toHaveBeenCalledWith('deleteMessage',{chat_id:channel,message_id:11});
});
test('all historical duplicate receipts are cleaned while the current matching post is reused',async()=>{
 const data=snapshot(),hash=hashMessage(buildResumeChannelMessage(data.entity,data.region_slug));const h=reader([data,[post(),post({id:I,message_id:12,message_hash:hash})],true,data]),t=transport();const result=await reconcileChannelEntity(h.client,event,t,async()=>{});expect(result).toMatchObject({deleted:1,skipped:1});expect(t.call).toHaveBeenCalledWith('deleteMessage',{chat_id:channel,message_id:10});expect(t.send).not.toHaveBeenCalled();expect(h.requests[1].url.pathname).toContain('channel_delivery_receipts');
});
const resolveRequest=(body:any,authorized=true)=>new NextRequest('http://localhost/api/maintenance/channel-deliveries',{method:'POST',headers:authorized?{authorization:'Bearer synthetic-cron-secret'}:{},body:JSON.stringify(body)});
const resolution={intentId:I,expectedUpdatedAt:'2026-10-10T10:00:00.123456+00:00',resolution:'verified_not_delivered'};
test('delivery maintenance requires a configured secret before reading or resolving',async()=>{
 expect((await listDeliveries(request(undefined,false))).status).toBe(401);expect((await resolveDelivery(resolveRequest(resolution,false))).status).toBe(401);expect(createClient).not.toHaveBeenCalled();
});
test.each([{...resolution,expectedUpdatedAt:null},{...resolution,resolution:'retry'},{...resolution,messageId:11},{...resolution,resolution:'verified_message',messageId:-1},{...resolution,resolution:'verified_message',messageId:'11'},{...resolution,channel:'@foreign'}])('maintenance rejects an unverified or malformed resolution before database access: %p',async body=>{
 expect((await resolveDelivery(resolveRequest(body))).status).toBe(400);expect(createClient).not.toHaveBeenCalled();
});
test('resolution preserves the exact version, requires confirmation, and handles stale or in-flight state',async()=>{
 const h=reader([true]);(createClient as jest.Mock).mockReturnValue(h.client);expect((await resolveDelivery(resolveRequest(resolution))).status).toBe(200);expect(h.requests[0].body).toMatchObject({p_expected_updated:resolution.expectedUpdatedAt,p_message:null,p_not_delivered:true});
 for(const reply of [false,{error:{code:'55000'}}]){const changed=reader([reply]);(createClient as jest.Mock).mockReturnValue(changed.client);expect((await resolveDelivery(resolveRequest(resolution))).status).toBe(409);}
});
test('operator list is keyset-paged and selects no content, credentials or lease tokens',async()=>{
 const rows=Array.from({length:101},(_,i)=>({id:'40000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),status:'uncertain'}));const h=reader([rows]);(createClient as jest.Mock).mockReturnValue(h.client);const response=await listDeliveries(request('http://localhost/api/maintenance/channel-deliveries?after='+I));expect(await response.json()).toMatchObject({items:rows.slice(0,100),nextCursor:rows[99].id});expect(h.requests[0].url.searchParams.get('select')).not.toMatch(/lease_token|snapshot|phone|message_hash/);expect(response.headers.get('cache-control')).toBe('no-store');
});

test('a confirmed edit updates the exact known receipt and rechecks visibility after Telegram responds',async()=>{
 const h=reader([snapshot(),[post()],snapshot(),snapshot(),true]),t=transport();expect((await reconcileChannelEntity(h.client,event,t,async()=>{})).edited).toBe(1);expect(h.requests[4].body).toMatchObject({p_token:T,p_event:E,p_receipt:P,p_status:'active'});expect(t.send).not.toHaveBeenCalled();
});
test('closing publication while an edit is in flight immediately removes its known message',async()=>{
 const h=reader([snapshot(),[post()],snapshot(),hidden,true]),t=transport();expect(await reconcileChannelEntity(h.client,event,t,async()=>{})).toMatchObject({edited:1,deleted:1});expect(t.call).toHaveBeenCalledWith('deleteMessage',{chat_id:channel,message_id:10});expect(h.requests[4].body.p_status).toBe('deleted');
});
test('partial worker failure returns an HTTP failure rather than a successful health check',async()=>{
 const h=reader([true,true,(req:any)=>({...event,lease_token:req.body.p_token,status:'processing',attempts:1}),{error:{code:'08006'}},true,true,null,0,true]);(createClient as jest.Mock).mockReturnValue(h.client);const response=await runWorker(request());expect(response.status).toBe(503);expect(await response.json()).toMatchObject({success:false,failed:1,done:0});
});

test('an exhausted uncertain delivery keeps an otherwise empty worker unhealthy until an operator resolves it',async()=>{
 const h=reader([true,true,null,1,true]);(createClient as jest.Mock).mockReturnValue(h.client);const response=await runWorker(request());expect(response.status).toBe(503);expect(await response.json()).toMatchObject({success:false,processed:0,outstandingReview:1});
});
test('a blocked durable reservation is visible in both queue failure and worker review counts',async()=>{
 const h=reader([true,true,(req:any)=>({...event,lease_token:req.body.p_token,status:'processing',attempts:1}),snapshot(),[],snapshot(),true,{error:{code:'55000'}},true,true,null,1,true]);
 (createClient as jest.Mock).mockReturnValue(h.client);const response=await runWorker(request());expect(response.status).toBe(503);expect(await response.json()).toMatchObject({failed:1,done:0,needsReview:1,outstandingReview:1});expect(h.requests.find(r=>r.url.pathname.includes('channel_finish')).body.p_error).toContain('automatic send blocked');
});

test('cleanup reads every historical receipt beyond the first REST page without dropping message IDs',async()=>{
 const rows=Array.from({length:501},(_,i)=>post({id:'20000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),message_id:i+1}));const h=reader([hidden,rows.slice(0,500),rows.slice(500),...Array(501).fill(true)]),t=transport();expect((await reconcileChannelEntity(h.client,event,t,async()=>{})).deleted).toBe(501);expect(t.call).toHaveBeenCalledTimes(501);expect(h.requests[2].url.searchParams.get('id')).toBe('gt.'+rows[499].id);expect(t.send).not.toHaveBeenCalled();
});
