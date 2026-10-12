/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {readAuthUser,signAuthToken,passwordVersion,SESSION_COOKIE} from '@/lib/auth/server';
import {requireAccount} from '@/lib/auth/account';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const id='00000000-0000-4000-8000-000000000001',phone='+998901234567';
function fixture(missing:string[],extra:any={}){
 const fields:string[]=[];const client:any={from:()=>{let selected='';const q:any={select:(value:string)=>{selected=value;fields.push(value);return q;},eq:()=>q,maybeSingle:async()=>{
  const absent=missing.find(column=>selected.split(',').includes(column));if(absent)return {data:null,error:{code:'42703',message:'column '+absent+' does not exist'}};
  const row={id,phone,password_hash:'synthetic-hash',closed_at:'2026-10-07T00:00:00Z',session_version:3,...extra};return {data:Object.fromEntries(selected.split(',').map(key=>[key,(row as any)[key]])),error:null};
 }};return q;}};return {client,fields};
}
test('a missing session_version column never suppresses an existing closed_at during session validation',async()=>{
 process.env.AUTH_SESSION_SECRET='synthetic-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';
 const {client,fields}=fixture(['session_version']);(createClient as jest.Mock).mockReturnValue(client);
 const token=signAuthToken({purpose:'session',userId:id,phone,expiresAt:Date.now()+60000,passwordVersion:passwordVersion('synthetic-hash')});
 const request=new NextRequest('http://localhost',{headers:{cookie:`${SESSION_COOKIE}=${token}`}});
 await expect(requireAccount(request)).rejects.toEqual(expect.objectContaining({status:401}));expect(fields.at(-1)).toContain('closed_at');
});
test('known missing columns are removed one at a time while a remaining session epoch is retained',async()=>{
 const {client,fields}=fixture(['closed_at']);const result=await readAuthUser(client,'id,phone,password_hash','id',id);expect(result.data.session_version).toBe(3);expect(fields.at(-1)).toContain('session_version');
 const old=fixture(['closed_at','session_version']);expect((await readAuthUser(old.client,'id','id',id)).data.id).toBe(id);expect(old.fields).toHaveLength(3);
});
test('unrelated database errors are never retried with fewer account protections',async()=>{
 const maybeSingle=jest.fn(async()=>({data:null,error:{code:'08006',message:'Unavailable closed_at session_version'}}));const q:any={select:()=>q,eq:()=>q,maybeSingle};
 expect((await readAuthUser({from:()=>q} as any,'id','id',id)).error.code).toBe('08006');expect(maybeSingle).toHaveBeenCalledTimes(1);
});
