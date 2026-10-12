/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {GET,POST} from '@/app/api/admin/admins/route';
import {PATCH} from '@/app/api/admin/admins/[id]/route';
import {readFileSync} from 'fs';
import {runInNewContext} from 'vm';
import {transpileModule} from 'typescript';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',R='10000000-0000-4000-8000-000000000001',L='20000000-0000-4000-8000-000000000001',V='2026-10-07T00:00:00.123456Z';
const rpc=jest.fn(),getUser=jest.fn(),lookup=jest.fn(),create=jest.fn();let actor:any,existing:any,rpcFault:string|null;
const row=()=>({id:B,full_name:'New admin',email:'new@example.test',role:'hokimlik_assistant',district_id:100,disabled_at:null,updated_at:V,private_note:'hidden',password:'hidden',districts:{name_ru:'Район',name_uz:'Tuman',region_id:22,private_note:'hidden',regions:{name_ru:'Область',name_uz:'Viloyat',private_note:'hidden'}}});
const body=(patch:any={})=>({request_id:R,full_name:' New admin ',email:' NEW@example.test ',password:'synthetic-password',role:'hokimlik_assistant',district_id:100,...patch});
function req(method='GET',data?:any,path='/api/admin/admins',headers:any={authorization:'Bearer synthetic'}){return new NextRequest('http://localhost'+path,{method,headers:{...headers,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});}
const ctx=(id=B)=>({params:Promise.resolve({id})});
beforeEach(()=>{
 jest.clearAllMocks();process.env.AUTH_SESSION_SECRET='synthetic';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';actor={id:A,full_name:'Actor',role:'super_admin',district_id:null,disabled_at:null,updated_at:V};existing=null;rpcFault=null;
 getUser.mockResolvedValue({data:{user:{id:A}},error:null});lookup.mockImplementation(async()=>({data:{user:existing},error:existing?null:{status:404,code:'user_not_found'}}));
 create.mockImplementation(async(input:any)=>{existing={id:input.id,email:input.email,app_metadata:input.app_metadata};return {data:{user:existing},error:null};});
 rpc.mockImplementation(async(name:string)=>rpcFault?{data:null,error:{code:rpcFault}}:{data:name==='ishdasiz_admin_list_profiles'?{admins:[row()],total:1205}:name==='ishdasiz_admin_reserve_creation'?{target_id:B,lease_id:L}:row(),error:null});
 (createClient as jest.Mock).mockReturnValue({auth:{getUser,admin:{getUserById:lookup,createUser:create}},rpc,from:(table:string)=>{if(table!=='admin_profiles')throw new Error('Unexpected private table');const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:actor,error:null})};return q;}});
});
test('only fresh verified super admins may manage profiles; cookies, helpers and disabled profiles are denied',async()=>{
 expect((await GET(req('GET',undefined,undefined,{cookie:'ishdasiz_session=forged'}))).status).toBe(401);expect(getUser).not.toHaveBeenCalled();
 for(const patch of [{role:'hokimlik_assistant'},{role:'unknown'},{role:'super_admin',disabled_at:V}]){Object.assign(actor,patch);expect((await GET(req())).status).toBe(403);expect((await POST(req('POST',body()))).status).toBe(403);expect((await PATCH(req('PATCH',{action:'disable',expected_updated_at:V}),ctx())).status).toBe(403);}
 expect(rpc).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
});
test('cross-origin writes are rejected before credentials or creation are checked',async()=>{
 expect((await POST(req('POST',body(),undefined,{authorization:'Bearer synthetic',origin:'https://foreign.test'}))).status).toBe(403);expect((await PATCH(req('PATCH',{action:'enable',expected_updated_at:V},undefined,{authorization:'Bearer synthetic',origin:'https://foreign.test'}),ctx())).status).toBe(403);expect(getUser).not.toHaveBeenCalled();
});
test('protected lists use exact paging, literal search and only explicit display fields',async()=>{
 const response=await GET(req('GET',undefined,'/api/admin/admins?page=24&state=disabled&search=%25_%22'));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');const data=await response.json();expect(data).toMatchObject({total:1205,page:24,hasMore:false});expect(JSON.stringify(data)).not.toMatch(/private_note|password/);expect(rpc).toHaveBeenCalledWith('ishdasiz_admin_list_profiles',{p_actor_id:A,p_page:24,p_state:'disabled',p_search:'%_"'});
 for(const path of ['?page=-1','?page=1.5','?state=unknown','?search='+('a'.repeat(101))])expect((await GET(req('GET',undefined,'/api/admin/admins'+path))).status).toBe(400);
});
test('creation reserves a server ID first, normalizes data and does not store a password in database RPCs',async()=>{
 const response=await POST(req('POST',body({id:A,disabled_at:V,role:'super_admin',district_id:100,user_metadata:{role:'super_admin'}})));expect(response.status).toBe(201);const args=rpc.mock.calls[0][1];expect(args).toMatchObject({p_actor_id:A,p_request_id:R,p_profile:{email:'new@example.test',full_name:'New admin',role:'super_admin',district_id:null}});expect(args.p_fingerprint).toMatch(/^[0-9a-f]{64}$/);expect(JSON.stringify(rpc.mock.calls)).not.toContain('synthetic-password');expect(create).toHaveBeenCalledWith(expect.objectContaining({id:B,email_confirm:true,password:'synthetic-password',app_metadata:{ishdasiz_admin_request:R,ishdasiz_admin_actor:A}}));expect(rpc).toHaveBeenCalledWith('ishdasiz_admin_complete_creation',{p_actor_id:A,p_request_id:R,p_lease_id:L});expect(JSON.stringify(await response.json())).not.toMatch(/private_note|password/);
});
test.each([{password:'short'},{password:'я'.repeat(37)},{request_id:'forged'},{role:'unknown'},{district_id:null},{district_id:'100'},{full_name:''},{email:'invalid'}])('invalid creation input is rejected before auth mutation: %p',async patch=>{expect((await POST(req('POST',body(patch)))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();});
test('completed retries return the current profile without calling auth user creation',async()=>{
 rpc.mockResolvedValueOnce({data:{profile:{...row(),disabled_at:V}},error:null});const response=await POST(req('POST',body()));expect(response.status).toBe(201);expect((await response.json()).profile.disabled_at).toBe(V);expect(lookup).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
});
test('auth committed before a lost response is recovered with the same ID and never overwritten',async()=>{
 create.mockImplementationOnce(async input=>{existing={id:input.id,email:input.email,app_metadata:input.app_metadata};return {data:{user:null},error:{status:503}};});expect((await POST(req('POST',body()))).status).toBe(201);expect(create).toHaveBeenCalledTimes(1);expect(lookup).toHaveBeenCalledTimes(2);
 create.mockClear();expect((await POST(req('POST',body()))).status).toBe(201);expect(create).not.toHaveBeenCalled();
});
test('an unrelated auth record is never adopted, and temporary lookup failures do not trigger creation',async()=>{
 existing={id:B,email:'new@example.test',app_metadata:{}};expect((await POST(req('POST',body()))).status).toBe(409);expect(create).not.toHaveBeenCalled();expect(rpc.mock.calls.some(([name])=>name==='ishdasiz_admin_complete_creation')).toBe(false);expect(rpc).toHaveBeenLastCalledWith('ishdasiz_admin_release_creation',{p_actor_id:A,p_request_id:R,p_lease_id:L});
 lookup.mockResolvedValueOnce({data:{user:null},error:{status:503}});expect((await POST(req('POST',body()))).status).toBe(503);expect(create).not.toHaveBeenCalled();
});
test('missing migrations and revoked permissions fail before creating an auth user',async()=>{
 for(const [code,status] of [['42883',503],['42501',403],['55P03',409],['40001',409],['22023',400]]){rpcFault=code;expect((await POST(req('POST',body()))).status).toBe(status);}expect(create).not.toHaveBeenCalled();
});
test('email conflicts never reset or delete existing credentials',async()=>{
 create.mockResolvedValueOnce({data:{user:null},error:{code:'email_exists'}});expect((await POST(req('POST',body()))).status).toBe(409);expect(lookup.mock.calls.every(([id])=>id===B)).toBe(true);expect(rpc.mock.calls.some(([name])=>name==='ishdasiz_admin_complete_creation')).toBe(false);
});
test('edits and soft access changes preserve microsecond versions and filter injected fields',async()=>{
 expect((await PATCH(req('PATCH',{action:'edit',expected_updated_at:V,full_name:'Changed',role:'hokimlik_assistant',district_id:200,password:'injected',disabled_at:null}),ctx())).status).toBe(200);expect(rpc).toHaveBeenLastCalledWith('ishdasiz_admin_update_profile',{p_actor_id:A,p_target_id:B,p_action:'edit',p_expected_version:V,p_payload:{full_name:'Changed',role:'hokimlik_assistant',district_id:200}});
 expect((await PATCH(req('PATCH',{action:'disable',expected_updated_at:V,password:'injected'}),ctx())).status).toBe(200);expect(rpc.mock.calls.at(-1)[1].p_payload).toEqual({});expect((await PATCH(req('PATCH',{action:'delete',expected_updated_at:V}),ctx())).status).toBe(400);expect((await PATCH(req('PATCH',{action:'edit',expected_updated_at:null}),ctx())).status).toBe(400);
});
test('retired edge endpoint performs no auth operations or body reads',async()=>{
 let handler:any;const code=transpileModule(readFileSync('supabase/functions/create-admin/index.ts','utf8'),{}).outputText;runInNewContext(code,{Deno:{serve:(fn:any)=>handler=fn},Response});const read=jest.fn(()=>{throw new Error('Must not read credentials');});const response=handler({method:'POST',json:read});expect(response.status).toBe(410);expect(response.headers.get('cache-control')).toBe('no-store');expect(handler({method:'OPTIONS'}).status).toBe(204);expect(read).not.toHaveBeenCalled();
});
