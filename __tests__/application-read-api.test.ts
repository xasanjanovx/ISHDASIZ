/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PATCH } from '@/app/api/account/applications/seen/route';
import { AccountError,requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
jest.mock('@/lib/auth/account',()=>({...jest.requireActual('@/lib/auth/account'),requireAccount:jest.fn()}));
jest.mock('@/lib/account-chat',()=>({...jest.requireActual('@/lib/account-chat'),requireChatRole:jest.fn()}));
const U='00000000-0000-4000-8000-000000000001',A='abcdef00-0000-4000-8000-000000000002',B='00000000-0000-4000-8000-000000000003';
const snapshot=(id=A,patch:any={})=>({id,status:'accepted',responded_at:'2026-10-10T01:02:03.123456Z',...patch});
let requests:any[],reply:any,error:any,networkFailure:boolean;
function request(body:any={applications:[snapshot()]},origin?:string){return new NextRequest('http://localhost/api/account/applications/seen',{method:'PATCH',headers:origin?{origin}:{},body:JSON.stringify(body)});}
beforeEach(()=>{
 jest.clearAllMocks();requests=[];reply={seen:[A],changed:[]};error=null;networkFailure=false;
 const client=createClient('https://example.supabase.co','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input:any,init:any)=>{requests.push({url:new URL(String(input)),method:init?.method,body:JSON.parse(init.body)});if(networkFailure)throw Error('Private network details');return new Response(JSON.stringify(error||reply),{status:error?500:200,headers:{'Content-Type':'application/json'}});}}});
 (requireAccount as jest.Mock).mockResolvedValue({client,user:{id:U,session_version:6}});(requireChatRole as jest.Mock).mockResolvedValue({id:B});
});

test('one RPC receives the authenticated epoch and exact microsecond snapshots, without table fallbacks or caller identity fields',async()=>{
 reply={seen:[A],changed:[B]};const response=await PATCH(request({applications:[snapshot(A.toUpperCase(),{full_name:'Never transmit'}),snapshot(B,{status:'reviewed',responded_at:null})],user_id:B,session_version:999}));
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual(reply);expect(requireChatRole).toHaveBeenCalledWith(expect.anything(),U,'job_seeker');
 expect(requests).toHaveLength(1);expect(requests[0].url.pathname).toBe('/rest/v1/rpc/ishdasiz_application_seen');expect(requests[0].method).toBe('POST');
 expect(requests[0].body).toEqual({p_user_id:U,p_session_version:6,p_snapshots:[snapshot(),snapshot(B,{status:'reviewed',responded_at:null})]});
});
test('unsigned, cross-origin and wrong-role requests perform no receipt write',async()=>{
 expect((await PATCH(request(undefined,'https://foreign.example'))).status).toBe(403);
 (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401,'Login'));expect((await PATCH(request())).status).toBe(401);
 (requireAccount as jest.Mock).mockResolvedValue({client:{},user:{id:U}});(requireChatRole as jest.Mock).mockRejectedValue(new AccountError(403,'Role'));expect((await PATCH(request())).status).toBe(403);expect(requests).toHaveLength(0);
});
test.each([undefined,null,[],{},[{}],[snapshot('bad')],[snapshot(A,{status:'x'.repeat(31)})],[snapshot(A,{responded_at:'now),user_id.neq.null'})],[snapshot(A,{responded_at:undefined})],[snapshot(),snapshot(A.toUpperCase())],Array.from({length:21},()=>snapshot())])('invalid snapshots fail before RPC (%j)',async applications=>{
 expect((await PATCH(request({applications}))).status).toBe(400);expect(requests).toHaveLength(0);
});
test.each([-1,1.5,NaN])('invalid session epoch %s cannot clear notifications',async session_version=>{
 (requireAccount as jest.Mock).mockResolvedValue({client:{},user:{id:U,session_version}});expect((await PATCH(request())).status).toBe(401);expect(requests).toHaveLength(0);
});
test.each([['42501',401],['P0002',404],['22023',400],['22007',400],['22008',400],['42883',503],['08006',503]])('SQL rejection %s is safe and never falls back to a direct update',async(code,status)=>{
 error={code,message:'Private database content',details:'Private contacts'};const response=await PATCH(request());expect(response.status).toBe(status);expect(response.headers.get('cache-control')).toBe('no-store');expect(JSON.stringify(await response.json())).not.toMatch(/Private/);expect(requests).toHaveLength(1);
});
test.each([null,{},[],{seen:[A],changed:[A]},{seen:[],changed:[]},{seen:[B],changed:[]},{seen:[A],changed:null},{seen:['bad'],changed:[]}])('an incomplete or foreign receipt cannot report success (%j)',async value=>{
 reply=value;const response=await PATCH(request());expect(response.status).toBe(503);expect(requests).toHaveLength(1);
});
test('network failures preserve generic errors without a weaker retry',async()=>{
 networkFailure=true;const response=await PATCH(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('Private');expect(requests).toHaveLength(1);
});
