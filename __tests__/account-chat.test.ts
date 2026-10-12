/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SESSION_COOKIE, passwordVersion, signAuthToken } from '@/lib/auth/server';
import { GET as listChats, POST as createChat } from '@/app/api/account/chat/route';
import { GET as readChat, POST as sendMessage, PATCH as markRead, DELETE as archiveChat } from '@/app/api/account/chat/[id]/route';
import { GET as unread } from '@/app/api/account/chat/unread/route';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const C='00000000-0000-4000-8000-000000000003';
const AB='10000000-0000-4000-8000-000000000001';
const BC='10000000-0000-4000-8000-000000000002';
const M1='20000000-0000-4000-8000-000000000001';
const M2='20000000-0000-4000-8000-000000000002';
const M3='20000000-0000-4000-8000-000000000003';
let rows: Record<string, any[]>;
let operations: { table: string; operation: string; body?: any }[];

function parts(value: string) {
 let level=0,start=0;const chunks:string[]=[];
 for(let i=0;i<value.length;i++){if(value[i]==='(')level++;if(value[i]===')')level--;if(value[i]===','&&level===0){chunks.push(value.slice(start,i));start=i+1;}}
 chunks.push(value.slice(start));return chunks;
}
function expression(row:any,value:string):boolean {
 if(value.startsWith('and('))return parts(value.slice(4,-1)).every(v=>expression(row,v));
 if(value.startsWith('or('))return parts(value.slice(3,-1)).some(v=>expression(row,v));
 const match=value.match(/^(\w+)\.(eq|neq|is|lt|lte|gt|gte)\.(.*)$/);if(!match)throw new Error('Unsupported test filter: '+value);
 const [,field,op,raw]=match;const actual=row[field];const expected=raw==='null'?null:raw;
 if(op==='is')return actual==null;
 if(op==='eq')return String(actual)===expected;
 if(op==='neq')return String(actual)!==expected;
 if(op==='lt')return actual<expected!;if(op==='lte')return actual<=expected!;if(op==='gt')return actual>expected!;return actual>=expected!;
}
function client() {
 return { from: (table:string) => {
  let operation='select',body:any,options:any={},selectAfterMutation=false,offset=0,size=Infinity;
  const filters:((row:any)=>boolean)[]=[];const sorts:{column:string;ascending:boolean}[]=[];
  const q:any={
   select: (_fields:string,opts:any={})=>{options=opts;selectAfterMutation=operation!=='select';return q;},
   eq: (field:string,value:any)=>{filters.push(r=>r[field]===value);return q;},
   neq:(field:string,value:any)=>{filters.push(r=>r[field]!==value);return q;},
   gt:(field:string,value:any)=>{filters.push(r=>r[field]>value);return q;},
   in:(field:string,values:any[])=>{filters.push(r=>values.includes(r[field]));return q;},
   not:(field:string,op:string,value:any)=>{filters.push(r=>r[field]!=null);return q;},
   or:(expr:string)=>{filters.push(r=>parts(expr).some(v=>expression(r,v)));return q;},
   order:(column:string,opts:any={})=>{sorts.push({column,ascending:opts.ascending!==false});return q;},
   range:(start:number,end:number)=>{offset=start;size=end-start+1;return q;},
   limit:(limit:number)=>{size=limit;return q;},
   insert:(value:any)=>{operation='insert';body=value;return q;},
   update:(value:any)=>{operation='update';body=value;return q;},
   upsert:(value:any)=>{operation='upsert';body=value;return q;},
   delete:()=>{operation='delete';return q;},
  };
  const run=async(single=false)=>{
   operations.push({table,operation,body});
   let data=(rows[table]||[]).filter(r=>filters.every(f=>f(r)));
   if(operation==='insert') { const row={id:'30000000-0000-4000-8000-000000000001',created_at:'2026-10-06T12:05:00.000Z',...body};rows[table].push(row);data=[row]; }
   if(operation==='update')data.forEach(r=>Object.assign(r,body));
   if(operation==='upsert'){let row=rows[table].find(r=>r.user_id===body.user_id&&r.conversation_id===body.conversation_id);if(row)Object.assign(row,body);else{row={...body};rows[table].push(row);}data=[row];}
   const count=data.length;
   data=[...data].sort((a,b)=>{for(const s of sorts){const c=String(a[s.column]||'').localeCompare(String(b[s.column]||''));if(c)return s.ascending?c:-c;}return 0;}).slice(offset,offset+size);
   return {data:options.head?null:operation!=='select'&&!selectAfterMutation?null:single?data[0]||null:data,count:options.count?count:null,error:null};
  };
  q.maybeSingle=()=>run(true);q.single=()=>run(true);q.then=(resolve:any,reject:any)=>run().then(resolve,reject);
  return q;
 },rpc: (name:string,body:any) => {
  operations.push({table:'rpc',operation:name,body});
  const run=()=>{
   const fail=(code:string)=>({data:null,error:{code}}),u=rows.users.find(row=>row.id===body.p_user_id),role=body.p_role,other=role==='employer'?'job_seeker':'employer';
   if(!u||u.closed_at||(u.session_version??0)!==body.p_session_version)return fail('42501');
   const profile=(who:string,r:string)=>rows[r==='employer'?'employer_profiles':'job_seeker_profiles'].some(row=>row.user_id===who);
   if(!profile(u.id,role))return fail('28000');
   let chat=rows.conversations.find(row=>row.id===body.p_conversation_id);
   const matches=(row:any,who:string,r:string)=>{const actual=row.user1_id===who?row.user1_role:row.user2_role;return !actual||actual===r;};
   if(body.p_action==='open'){
    const peer=body.p_partner_id;chat=rows.conversations.find(row=>[row.user1_id,row.user2_id].includes(u.id)&&[row.user1_id,row.user2_id].includes(peer)&&matches(row,u.id,role)&&matches(row,peer,other));
    if(chat)return {data:{id:chat.id,created:false},error:null};
    if(!rows.users.some(row=>row.id===peer&&!row.closed_at)||!profile(peer,other))return fail('P0001');
    const [first,second]=[u.id,peer].sort();chat={id:'30000000-0000-4000-8000-000000000001',user1_id:first,user2_id:second,user1_role:first===u.id?role:other,user2_role:second===u.id?role:other,created_at:'2026-10-06T12:05:00.000Z'};rows.conversations.push(chat);return {data:{id:chat.id,created:true},error:null};
   }
   if(!chat||![chat.user1_id,chat.user2_id].includes(u.id))return fail('P0002');
   const peer=chat.user1_id===u.id?chat.user2_id:chat.user1_id;
   if(!matches(chat,u.id,role)||!matches(chat,peer,other))return fail('28000');
   const available=rows.users.some(row=>row.id===peer&&!row.closed_at)&&profile(peer,other);
   if(body.p_action==='inspect')return {data:{conversation:{...chat},can_send:available},error:null};
   if(body.p_action==='send'){
    let message=rows.messages.find(row=>row.id===body.p_request_id);
    if(message&&(message.sender_id!==u.id||message.conversation_id!==chat.id||message.content!==body.p_content))return fail('40001');
    if(!message){if(!available)return fail('P0001');message={id:body.p_request_id,conversation_id:chat.id,sender_id:u.id,content:body.p_content,is_read:false,created_at:'2026-10-06T12:05:00.000Z'};rows.messages.push(message);chat.updated_at=message.created_at;}
    const {id,content,sender_id,created_at}=message;return {data:{message:{id,content,sender_id,created_at}},error:null};
   }
   if(body.p_action==='read'){const anchor=rows.messages.find(row=>row.id===body.p_through&&row.conversation_id===chat.id);if(!anchor)return fail('22023');rows.messages.filter(row=>row.conversation_id===chat.id&&row.sender_id!==u.id&&(row.created_at<anchor.created_at||(row.created_at===anchor.created_at&&row.id<=anchor.id))).forEach(row=>row.is_read=true);}
   else if(body.p_action==='archive'){let pref=rows.conversation_preferences.find(row=>row.user_id===u.id&&row.conversation_id===chat.id);if(!pref){pref={user_id:u.id,conversation_id:chat.id};rows.conversation_preferences.push(pref);}pref.hidden_at='2026-10-06T12:05:00.000Z';}
   else if(body.p_action==='restore')rows.conversation_preferences.filter(row=>row.user_id===u.id&&row.conversation_id===chat.id).forEach(row=>row.hidden_at=null);
   return {data:{success:true},error:null};
  };
  return {abortSignal:()=>Promise.resolve(run())};
 } };
}
function req(method:string,path:string,body?:any,userId=A,origin?:string) {
 if(method==='POST'&&body?.content!==undefined)body={request_id:'30000000-0000-4000-8000-000000000001',...body};
 if(method==='PATCH')body={role:userId===B?'employer':'job_seeker',...body};
 if(method==='DELETE'&&!path.includes('role='))path+=(path.includes('?')?'&':'?')+'role='+(userId===B?'employer':'job_seeker');
 const token=signAuthToken({purpose:'session',userId,phone:'+998901234567',passwordVersion:passwordVersion('hash'),expiresAt:Date.now()+60000});
 return new NextRequest('http://localhost'+path,{method,headers:{cookie:`${SESSION_COOKIE}=${token}`,'content-type':'application/json',...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
beforeEach(()=>{
 process.env.AUTH_SESSION_SECRET='test-signing-key';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
 rows={users:[A,B,C].map(id=>({id,phone:'+998901234567',password_hash:'hash'})),job_seeker_profiles:[{id:'profile-a',user_id:A,full_name:'Alice'},{id:'profile-c',user_id:C,full_name:'Carol'}],employer_profiles:[{id:'profile-b',user_id:B,company_name:'Company B'}],
 conversations:[{id:AB,user1_id:A,user2_id:B,user1_role:'job_seeker',user2_role:'employer',updated_at:'2026-10-06T12:00:00.000Z',created_at:'2026-10-01T00:00:00.000Z'},{id:BC,user1_id:B,user2_id:C,user1_role:'employer',user2_role:'job_seeker',updated_at:'2026-10-06T12:00:00.000Z',created_at:'2026-10-01T00:00:00.000Z'}],
 messages:[{id:M1,conversation_id:AB,sender_id:B,content:'Hello Alice',is_read:false,created_at:'2026-10-06T12:00:00.000Z'},{id:M2,conversation_id:AB,sender_id:A,content:'My outgoing message',is_read:false,created_at:'2026-10-06T12:01:00.000Z'},{id:M3,conversation_id:BC,sender_id:B,content:'Private for Carol',is_read:false,created_at:'2026-10-06T12:00:00.000Z'}],conversation_preferences:[]};
 operations=[];(createClient as jest.Mock).mockReturnValue(client());
});
it('rejects an unsigned identity before touching the database',async()=>{
 const request=new NextRequest(`http://localhost/api/account/chat/${AB}?role=job_seeker`,{headers:{cookie:`${SESSION_COOKIE}=forged`, 'x-user-id':A}});
 expect((await readChat(request,{params:Promise.resolve({id:AB})})).status).toBe(401);expect(operations).toEqual([]);
});
it('invalidates account access after changing the password',async()=>{
 rows.users[0].password_hash='new-hash';expect((await readChat(req('GET',`/api/account/chat/${AB}?role=job_seeker`),{params:Promise.resolve({id:AB})})).status).toBe(401);
 expect(operations.map(o=>o.table)).toEqual(['users']);
});
it('does not read a conversation by guessing its URL',async()=>{
 const response=await readChat(req('GET',`/api/account/chat/${BC}?role=job_seeker`),{params:Promise.resolve({id:BC})});
 expect(response.status).toBe(404);expect(operations.some(o=>o.table==='messages')).toBe(false);
});
it('does not send or archive another person’s conversation',async()=>{
 expect((await sendMessage(req('POST',`/api/account/chat/${BC}`,{role:'job_seeker',content:'intrusion'}),{params:Promise.resolve({id:BC})})).status).toBe(404);
 expect((await archiveChat(req('DELETE',`/api/account/chat/${BC}`),{params:Promise.resolve({id:BC})})).status).toBe(404);
 expect(operations.some(o=>o.operation==='insert'||o.operation==='upsert')).toBe(false);
});
it('lists only the signed-in user’s conversations and never returns another chat or password',async()=>{
 const response=await listChats(req('GET','/api/account/chat?role=job_seeker'));
 expect(response.status).toBe(200);const result=await response.json();expect(result.conversations.map((c:any)=>c.id)).toEqual([AB]);
 expect(JSON.stringify(result)).not.toContain('Private for Carol');expect(JSON.stringify(result)).not.toContain('password_hash');
});
it('ignores a forged sender and returns one canonical saved message',async()=>{
 const response=await sendMessage(req('POST',`/api/account/chat/${AB}`,{role:'job_seeker',content:'  Real message  ',sender_id:B}),{params:Promise.resolve({id:AB})});
 expect(response.status).toBe(201);expect((await response.json()).message).toMatchObject({sender_id:A,content:'Real message'});
 expect(rows.messages.at(-1).sender_id).toBe(A);
});
it('rejects an empty or oversized message before inserting it',async()=>{
 for(const content of ['   ','x'.repeat(4001)])expect((await sendMessage(req('POST',`/api/account/chat/${AB}`,{role:'job_seeker',content}),{params:Promise.resolve({id:AB})})).status).toBe(400);
 expect(operations.some(o=>o.operation==='insert')).toBe(false);
});
it('marks only received messages through a visible cursor; outgoing and foreign messages stay untouched',async()=>{
 const response=await markRead(req('PATCH',`/api/account/chat/${AB}`,{action:'read',through:M2}),{params:Promise.resolve({id:AB})});
 expect(response.status).toBe(200);expect(rows.messages.find(m=>m.id===M1).is_read).toBe(true);expect(rows.messages.find(m=>m.id===M2).is_read).toBe(false);expect(rows.messages.find(m=>m.id===M3).is_read).toBe(false);
});
it('rejects a read cursor belonging to another conversation',async()=>{
 expect((await markRead(req('PATCH',`/api/account/chat/${AB}`,{action:'read',through:M3}),{params:Promise.resolve({id:AB})})).status).toBe(400);
 expect(rows.messages.every(m=>m.is_read===false)).toBe(true);
});
it('archives only for the current user and preserves the shared history',async()=>{
 expect((await archiveChat(req('DELETE',`/api/account/chat/${AB}`),{params:Promise.resolve({id:AB})})).status).toBe(200);
 expect(rows.conversation_preferences[0]).toMatchObject({user_id:A,conversation_id:AB});expect(rows.messages).toHaveLength(3);expect(rows.conversations).toHaveLength(2);
 expect(operations.some(o=>o.operation==='delete')).toBe(false);
 expect((await markRead(req('PATCH',`/api/account/chat/${AB}`,{action:'restore'}),{params:Promise.resolve({id:AB})})).status).toBe(200);expect(rows.conversation_preferences[0].hidden_at).toBeNull();
});
it('counts only unread received messages in the current role',async()=>{
 const response=await unread(req('GET','/api/account/chat/unread?role=job_seeker'));expect(response.status).toBe(200);expect((await response.json()).unread).toBe(1);
});
it('hides archived unread messages without marking them read and counts only new arrivals',async()=>{
 rows.conversation_preferences.push({user_id:A,conversation_id:AB,hidden_at:'2026-10-06T12:02:00.000Z'});
 expect((await (await unread(req('GET','/api/account/chat/unread?role=job_seeker'))).json()).unread).toBe(0);
 rows.messages.push({id:'20000000-0000-4000-8000-000000000004',conversation_id:AB,sender_id:B,content:'New arrival',created_at:'2026-10-06T12:03:00.000Z',is_read:false});
 expect((await (await unread(req('GET','/api/account/chat/unread?role=job_seeker'))).json()).unread).toBe(1);
 expect(rows.messages.find(m=>m.id===M1).is_read).toBe(false);
});
it('rejects a request from another origin before database access',async()=>{
 expect((await sendMessage(req('POST',`/api/account/chat/${AB}`,{role:'job_seeker',content:'hello'},A,'https://evil.example'),{params:Promise.resolve({id:AB})})).status).toBe(403);expect(operations).toEqual([]);
});
it('reuses the existing chat even when the original participant order is reversed',async()=>{
 const response=await createChat(req('POST','/api/account/chat',{role:'employer',userId:A},B));expect(response.status).toBe(200);expect((await response.json()).id).toBe(AB);
 expect(operations.some(o=>o.operation==='insert')).toBe(false);
});

it('pages identical message timestamps by ID without omissions or duplicates',async()=>{
 rows.messages=Array.from({length:55},(_,i)=>({id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,conversation_id:AB,sender_id:B,content:`message ${i+1}`,is_read:false,created_at:'2026-10-06T12:00:00.000Z'}));
 const latest=await (await readChat(req('GET',`/api/account/chat/${AB}?role=job_seeker`),{params:Promise.resolve({id:AB})})).json();
 expect(latest.messages).toHaveLength(50);expect(latest.more).toBe(true);expect(latest.messages[0].content).toBe('message 6');
 const earlier=await (await readChat(req('GET',`/api/account/chat/${AB}?role=job_seeker&before=${latest.cursor}`),{params:Promise.resolve({id:AB})})).json();
 expect(earlier.messages).toHaveLength(5);expect(earlier.more).toBe(false);expect(new Set([...earlier.messages,...latest.messages].map(m=>m.id)).size).toBe(55);
 const newer=await (await readChat(req('GET',`/api/account/chat/${AB}?role=job_seeker&after=${earlier.messages.at(-1).id}`),{params:Promise.resolve({id:AB})})).json();
 expect(newer.messages).toHaveLength(50);expect(newer.messages[0].content).toBe('message 6');
});

it('keeps conversations separate when both people have both profiles',async()=>{
 rows.employer_profiles.push({id:'profile-a-employer',user_id:A,company_name:'Company A'});rows.job_seeker_profiles.push({id:'profile-b-seeker',user_id:B,full_name:'Bob'});
 const response=await createChat(req('POST','/api/account/chat',{role:'employer',userId:B},A));expect(response.status).toBe(201);
 expect(rows.conversations.at(-1)).toMatchObject({user1_id:A,user2_id:B,user1_role:'employer',user2_role:'job_seeker'});
 expect(rows.conversations[0]).toMatchObject({id:AB,user1_role:'job_seeker',user2_role:'employer'});
});

it('a new arrival a microsecond after archive revives the chat within the same millisecond',async()=>{
 rows.conversation_preferences.push({user_id:A,conversation_id:AB,hidden_at:'2026-10-06T12:02:00.123456Z'});
 rows.messages.push({id:'20000000-0000-4000-8000-000000000004',conversation_id:AB,sender_id:B,content:'New microsecond arrival',created_at:'2026-10-06T12:02:00.123457Z',is_read:false});
 const result=await (await listChats(req('GET','/api/account/chat?role=job_seeker'))).json();expect(result.conversations.map((row:any)=>row.id)).toEqual([AB]);expect(result.conversations[0].lastMessage).toBe('New microsecond arrival');expect(result.conversations[0].unread).toBe(1);
});
