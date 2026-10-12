/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GET as list } from '@/app/api/account/offers/route';
import { GET as detail } from '@/app/api/account/offers/[id]/route';
import { POST as seen } from '@/app/api/account/offers/[id]/seen/route';
import { AccountError,requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
jest.mock('@/lib/auth/account',() => ({ ...jest.requireActual('@/lib/auth/account'),requireAccount: jest.fn() }));
jest.mock('@/lib/account-chat',() => ({ requireChatRole: jest.fn() }));
const S='00000000-0000-4000-8000-000000000001',T='00000000-0000-4000-8000-000000000002',J='10000000-0000-4000-8000-000000000001',R='20000000-0000-4000-8000-000000000001';
const id=(n:number) => '30000000-0000-4000-8000-'+String(n).padStart(12,'0'),DATE='2026-10-10T00:00:00.123456Z';
const row=(n=1,extra:any={}) => ({ id:id(n),seeker_user_id:S,job_id:J,status:'sent',created_at:DATE,seen_at:null,job_available:true,job:{id:J,title_ru:'Vacancy',company_name:'Company'},...extra });
const full=(extra:any={}) => ({...row(),message:'Hello',resume_id:R,resume:{id:R,user_id:S,status:'active',found_job:false,title:'Own CV',birth_date:'PRIVATE'},job:{id:J,title_ru:'Vacancy',company_name:'Company',is_active:true,status:'active',private_unexpected:'PRIVATE'},...extra});
let replies:any[],calls:any[];
const request=(path:string,method='GET',origin?:string) => new NextRequest('http://localhost'+path,{method,headers:origin?{origin}:undefined});
const context=(offer=id(1)) => ({ params:Promise.resolve({id:offer}) });
beforeEach(()=>{
 replies=[];calls=[];jest.clearAllMocks();jest.spyOn(console,'error').mockImplementation(()=>{});
 const client=createClient('https://example.supabase.co','synthetic-test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input:any,init:any)=>{
  calls.push({url:new URL(String(input)),body:init?.body?JSON.parse(init.body):null});if(!replies.length)throw Error('Unexpected query');const result=replies.shift();return new Response(JSON.stringify(result?.error||result),{status:result?.error?500:200});
 }}});
 (requireAccount as jest.Mock).mockResolvedValue({client,user:{id:S,session_version:3}});(requireChatRole as jest.Mock).mockResolvedValue({id:S});
});
afterEach(()=>jest.restoreAllMocks());
test('private lists require a current authenticated seeker before reading history',async()=>{
 (requireAccount as jest.Mock).mockRejectedValueOnce(new AccountError(401,'Sign in'));const response=await list(request('/api/account/offers'));expect(response.status).toBe(401);expect(calls).toHaveLength(0);expect(requireChatRole).not.toHaveBeenCalled();
});
test('missing seeker profiles are reported without falling back to public invitation tables',async()=>{
 (requireChatRole as jest.Mock).mockRejectedValueOnce(new AccountError(403,'Seeker required'));expect((await list(request('/api/account/offers'))).status).toBe(403);expect(calls).toHaveLength(0);
});
test('lists use the verified recipient/epoch and return private no-store pages without owner or extra fields',async()=>{
 replies=[{items:[row(1,{private_unexpected:'PRIVATE'})],next_cursor:null}];const response=await list(request('/api/account/offers?user_id='+T));const body=await response.json();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(body.offers).toHaveLength(1);expect(JSON.stringify(body)).not.toContain('PRIVATE');expect(body.offers[0]).not.toHaveProperty('seeker_user_id');expect(calls[0].body).toMatchObject({p_user_id:S,p_session_version:3,p_page_size:20});expect(requireChatRole).toHaveBeenCalledWith(expect.anything(),S,'job_seeker');expect(calls).toHaveLength(1);
});
test('opaque cursor preserves exact microseconds and does not require reading an anchor or changing recipient filters',async()=>{
 const cursor=Buffer.from(JSON.stringify({id:id(10),created_at:DATE})).toString('base64url');replies=[{items:[row(9)],next_cursor:null}];expect((await list(request('/api/account/offers?before='+cursor))).status).toBe(200);expect(calls[0].body).toMatchObject({p_after_created:DATE,p_after_id:id(10),p_user_id:S});expect(calls).toHaveLength(1);
});
test.each(['bad-token',Buffer.from(JSON.stringify({id:id(1),created_at:DATE,private:true})).toString('base64url')])('invalid invitation cursors fail before accessing the database: %s',async cursor=>{
 expect((await list(request('/api/account/offers?before='+cursor))).status).toBe(400);expect(calls).toHaveLength(0);
});
test('detail reads do not mark invitations read and expose only the safe owned resume link',async()=>{
 replies=[full()];const response=await detail(request('/api/account/offers/'+id(1)),context());const body=await response.json();expect(response.status).toBe(200);expect(body.offer.resume).toEqual({id:R,title:'Own CV'});expect(JSON.stringify(body)).not.toContain('PRIVATE');expect(body.offer).not.toHaveProperty('seeker_user_id');expect(calls).toHaveLength(1);expect(calls[0].body).toEqual({p_user_id:S,p_session_version:3,p_offer_id:id(1),p_job_id:null});
});
test('foreign or removed invitation IDs return 404 without a job or resume fallback',async()=>{
 replies=[null];expect((await detail(request('/api/account/offers/'+id(1)),context())).status).toBe(404);expect(calls).toHaveLength(1);expect((await detail(request('/api/account/offers/bad'),context('bad'))).status).toBe(404);expect(calls).toHaveLength(1);
});
test('foreign origins cannot record a read even with a valid browser session',async()=>{
 expect((await seen(request('/api/account/offers/'+id(1)+'/seen','POST','https://attacker.example'),context())).status).toBe(403);expect(calls).toHaveLength(0);expect(requireAccount).not.toHaveBeenCalled();
});
test('read acknowledgements use recipient, epoch and invitation ID, and never mutate status through a table update',async()=>{
 replies=[{id:id(1),seeker_user_id:S,seen_at:DATE}];const response=await seen(request('/api/account/offers/'+id(1)+'/seen','POST'),context());expect(response.status).toBe(200);expect(await response.json()).toEqual({id:id(1),seen_at:DATE});expect(calls).toHaveLength(1);expect(calls[0].url.pathname).toBe('/rest/v1/rpc/ishdasiz_seeker_offer_seen');expect(calls[0].body).toEqual({p_user_id:S,p_session_version:3,p_offer_id:id(1)});
});
test('missing or foreign read acknowledgements never report success',async()=>{
 replies=[null];expect((await seen(request('/api/account/offers/'+id(1)+'/seen','POST'),context())).status).toBe(404);
 replies=[{id:id(1),seeker_user_id:T,seen_at:DATE}];expect((await seen(request('/api/account/offers/'+id(1)+'/seen','POST'),context())).status).toBe(503);
});
test('database outages and revoked epochs preserve their meaning without exposing database diagnostics',async()=>{
 replies=[{error:{code:'PGRST202',message:'PRIVATE SQL'}}];const outage=await list(request('/api/account/offers'));expect(outage.status).toBe(503);expect(JSON.stringify(await outage.json())).not.toContain('PRIVATE');expect(calls).toHaveLength(1);
 replies=[{error:{code:'42501',message:'PRIVATE identity'}}];expect((await list(request('/api/account/offers'))).status).toBe(401);
});
