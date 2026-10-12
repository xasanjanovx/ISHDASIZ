/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GET } from '@/app/api/resumes/[id]/route';
import { AccountError,requireAccount } from '@/lib/auth/account';
jest.mock('@/lib/auth/account',()=>({...jest.requireActual('@/lib/auth/account'),requireAccount:jest.fn()}));
const U='00000000-0000-4000-8000-000000000001',R='10000000-0000-4000-8000-000000000001';let reply:any,calls:any[],epoch:any;
const read=async(id=R)=>GET(new NextRequest('https://ishdasiz.uz/api/resumes/'+id),{params:Promise.resolve({id})});
beforeEach(()=>{calls=[];epoch=4;reply={id:R,user_id:U,title:'CV',telegram:'safe_handle',phone:'+998000000000',internal_note:'SECRET',password_hash:'SECRET',skills:['Excel'],experience:'[{"company_name":"Office","position":"Operator"}]',regions:{name_ru:'Область',name_uz:'Viloyat'}};const client=createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(url:any,init:any)=>{calls.push({url:String(url),body:JSON.parse(init.body)});return new Response(JSON.stringify(reply),{status:reply?.code?400:200,headers:{'Content-Type':'application/json'}});}}});(requireAccount as jest.Mock).mockImplementation(async()=>({client,user:{id:U,session_version:epoch}}));});
test('uses only epoch-checked RPC and projects safe normalized data with no caching',async()=>{const response=await read(),body=await response.json();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(calls).toEqual([{url:'https://synthetic.invalid/rest/v1/rpc/ishdasiz_catalog_resume',body:{p_user_id:U,p_session_version:4,p_resume_id:R}}]);expect(body.resume).toMatchObject({id:R,user_id:U,telegram:'safe_handle',experience_details:[{company:'Office',position:'Operator'}],regions:{name_ru:'Область'}});expect(JSON.stringify(body)).not.toContain('SECRET');});
test.each([401,403,503])('auth failure %s never queries the CV',async(status)=>{(requireAccount as jest.Mock).mockRejectedValue(new AccountError(status,'Unavailable'));expect((await read()).status).toBe(status);expect(calls).toHaveLength(0);});
test.each(['bad','a?x=1'])('invalid id %s is not queried',async(id)=>{expect((await read(id)).status).toBe(404);expect(calls).toHaveLength(0);});
test.each([-1,1.5,'4'])('invalid session epoch %s is rejected',async(value)=>{epoch=value;expect((await read()).status).toBe(401);expect(calls).toHaveLength(0);});
test('hidden CV gives 404; backend outages give 503 with no table fallback',async()=>{reply=null;expect((await read()).status).toBe(404);reply={code:'PGRST202',message:'SECRET'};const response=await read();expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('SECRET');expect(calls.every(c=>c.url.includes('/rpc/'))).toBe(true);});
test('database account/role denial is a gated response',async()=>{reply={code:'42501',message:'SECRET'};expect((await read()).status).toBe(403);});
test.each([{id:R,user_id:'bad'},{id:U,user_id:U}])('unexpected document is rejected',async(value)=>{reply=value;expect((await read()).status).toBe(503);});
test('unsafe Telegram handles are discarded',async()=>{reply.telegram='https://example.com';expect((await(await read()).json()).resume.telegram).toBeNull();});
