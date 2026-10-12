import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin,isUuid} from '@/lib/auth/account';
import {getAuthClient} from '@/lib/auth/server';
import {requirePublicJob} from '@/lib/public-job';
const COOKIE='ishdasiz_job_views';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 checkSameOrigin(request);const {id}=await params,client=getAuthClient();await requirePublicJob(client,id);
 let seen:string[]=[];
 try{const parsed=JSON.parse(Buffer.from(request.cookies.get(COOKIE)?.value||'','base64url').toString());if(Array.isArray(parsed))seen=parsed.filter(isUuid).slice(-30);}catch{}
 if(seen.includes(id))return accountResult({counted:false});
 const result=await client.rpc('increment_job_views',{job_uuid:id});if(result.error)throw result.error;
 const response=accountResult({counted:true});
 response.cookies.set(COOKIE,Buffer.from(JSON.stringify([...seen.filter(value=>value!==id),id].slice(-30))).toString('base64url'),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:3600});
 return response;
}catch(error){return accountFailure(error);}}
