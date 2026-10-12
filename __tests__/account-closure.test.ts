/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { POST as close } from '@/app/api/account/closure/route';
import { POST as restore } from '@/app/api/auth/restore-account/route';
import { DELETE as logout } from '@/app/api/auth/session/route';
import { requireAccount } from '@/lib/auth/account';
import { passwordVersion, readAuthUser, signAuthToken, verifyAuthToken, OTP_COOKIE, SESSION_COOKIE } from '@/lib/auth/server';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const phone='+998901234567',id='00000000-0000-4000-8000-000000000001';
let user:any,client:any,readError:any;
const token=(epoch=0,purpose:'password'|'session'='session')=>signAuthToken({purpose,userId:id,phone,expiresAt:Date.now()+60000,passwordVersion:passwordVersion('test-hash',epoch)});
function req(path:string,body:any,cookie?:string,origin?:string) {return new NextRequest(`http://localhost${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(origin?{origin}:{})},body:JSON.stringify(body)});}
beforeEach(()=>{
 process.env.AUTH_SESSION_SECRET='synthetic-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';
 user={id,phone,password_hash:'test-hash',session_version:0,closed_at:null};readError=null;
 client={rpc:jest.fn(async(_name:any,args:any)=>({data:args.p_expected_version+1,error:null})),from:jest.fn((table:string)=>{
  const chain:any={};for(const method of ['select','eq'])chain[method]=jest.fn(()=>chain);
  chain.maybeSingle=jest.fn(async()=>table==='users'?{data:user,error:readError}:{data:table==='job_seeker_profiles'?{id,full_name:'Saved name'}:null,error:null});return chain;
 })};(createClient as jest.Mock).mockReturnValue(client);
});
test('closed accounts reject current cookies, and old cookies stay revoked after restoration',async()=>{
 user.closed_at='2026-10-07T00:00:00Z';user.session_version=1;
 await expect(requireAccount(req('/private',{},`${SESSION_COOKIE}=${token(1)}`))).rejects.toMatchObject({status:401});
 user.closed_at=null;user.session_version=2;
 await expect(requireAccount(req('/private',{},`${SESSION_COOKIE}=${token(0)}`))).rejects.toMatchObject({status:401});
 await expect(requireAccount(req('/private',{},`${SESSION_COOKIE}=${token(2)}`))).resolves.toMatchObject({user:{id}});
});
test('close requires a signed owner and explicit confirmation, never an ID supplied in the body',async()=>{
 expect((await close(req('/api/account/closure',{confirm:true}))).status).toBe(401);
 expect((await close(req('/api/account/closure',{user_id:'forged'},`${SESSION_COOKIE}=${token()}`))).status).toBe(400);
 expect(client.rpc).not.toHaveBeenCalled();
 const response=await close(req('/api/account/closure',{confirm:true,user_id:'forged'},`${SESSION_COOKIE}=${token()}`));
 expect(response.status).toBe(200);expect(client.rpc).toHaveBeenCalledWith('ishdasiz_set_account_closed',{p_user_id:id,p_expected_version:0,p_close:true});
 expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('');expect(response.cookies.get(OTP_COOKIE)?.value).toBe('');expect(response.headers.get('cache-control')).toBe('no-store');
});
test('missing schema and atomic state conflicts are honest failures without fallback writes',async()=>{
 delete user.session_version;expect((await close(req('/api/account/closure',{confirm:true},`${SESSION_COOKIE}=${token()}`))).status).toBe(503);expect(client.rpc).not.toHaveBeenCalled();
 user.session_version=0;client.rpc.mockResolvedValue({error:{code:'40001'}});
 expect((await close(req('/api/account/closure',{confirm:true},`${SESSION_COOKIE}=${token()}`))).status).toBe(409);
});
test('restore needs SMS proof for the current closed epoch and does not accept a website session or body identity',async()=>{
 user.closed_at='2026-10-07T00:00:00Z';user.session_version=1;
 for(const cookie of [undefined,`${OTP_COOKIE}=${token(1)}`,`${OTP_COOKIE}=${token(0,'password')}`])
  expect((await restore(req('/api/auth/restore-account',{confirm:true,role:'job_seeker',user_id:id},cookie))).status).toBe(401);
 expect(client.rpc).not.toHaveBeenCalled();
});
test('restoring both profiles advances the epoch and gives fresh cookies; the consumed proof cannot be reused',async()=>{
 user.closed_at='2026-10-07T00:00:00Z';user.session_version=1;
 const oldProof=token(1,'password');const request=()=>req('/api/auth/restore-account',{confirm:true,role:'employer'},`${OTP_COOKIE}=${oldProof}`);
 const response=await restore(request());expect(response.status).toBe(200);
 expect((await response.json()).user.active_role).toBe('job_seeker');
 const fresh=verifyAuthToken(response.cookies.get(SESSION_COOKIE)?.value,'session');expect(fresh?.passwordVersion).toBe(passwordVersion('test-hash',2));
 expect(verifyAuthToken(response.cookies.get(OTP_COOKIE)?.value,'password')?.passwordVersion).toBe(passwordVersion('test-hash',2));
 user.closed_at=null;user.session_version=2;expect((await restore(request())).status).toBe(401);expect(client.rpc).toHaveBeenCalledTimes(1);
});
test('RPC failures preserve closure and do not mint a new session',async()=>{
 user.closed_at='2026-10-07T00:00:00Z';user.session_version=1;client.rpc.mockResolvedValue({error:{code:'40001'}});
 const response=await restore(req('/api/auth/restore-account',{confirm:true,role:'job_seeker'},`${OTP_COOKIE}=${token(1,'password')}`));
 expect(response.status).toBe(409);expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
});
test('cross-origin closure, restore and logout cannot mutate an account',async()=>{
 for(const [handler,path] of [[close,'/api/account/closure'],[restore,'/api/auth/restore-account'],[logout,'/api/auth/session']] as const)
  expect((await handler(req(path,{confirm:true,role:'job_seeker'},`${SESSION_COOKIE}=${token()}`,'https://foreign.example'))).status).toBe(403);
 expect(client.from).not.toHaveBeenCalled();expect(client.rpc).not.toHaveBeenCalled();
});
test('logout clears authentication and provider proofs without modifying account data',async()=>{
 const response=await logout(req('/api/auth/session',{}));expect(response.status).toBe(200);
 for(const name of [SESSION_COOKIE,OTP_COOKIE,'oneid_state','eri_state','pending_verification_user'])expect(response.cookies.get(name)?.value).toBe('');
 expect(client.from).not.toHaveBeenCalled();expect(response.headers.get('cache-control')).toBe('no-store');
});
test('legacy schema compatibility only retries missing lifecycle columns, never database outages',async()=>{
 readError={code:'42703',message:'column users.closed_at does not exist'};
 await readAuthUser(client,'id,phone,password_hash','id',id);expect(client.from).toHaveBeenCalledTimes(2);
 client.from.mockClear();readError={code:'08006',message:'connection failure'};
 expect((await readAuthUser(client,'id,phone,password_hash','id',id)).error).toEqual(readError);expect(client.from).toHaveBeenCalledTimes(1);
});
