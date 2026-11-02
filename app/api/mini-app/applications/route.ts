import {NextRequest} from 'next/server';
import {accountFailure,accountResult,requireAccount} from '@/lib/auth/account';
import {chatRole} from '@/lib/account-chat';
import {applicationQuery,publicApplication} from '@/lib/account-applications';
import {miniCandidateContext,miniCandidateRows} from '@/lib/mini-app/candidates';
export async function GET(request:NextRequest){try{
 const {client,user}=await requireAccount(request),role=chatRole(request.nextUrl.searchParams.get('role'));
 const profile=await client.from(role==='employer'?'employer_profiles':'job_seeker_profiles').select('id').eq('user_id',user.id).maybeSingle();
 if(profile.error)throw profile.error;if(!profile.data)return accountResult({applications:[]});
 const result=await applicationQuery(client,user.id,role,profile.data.id).order('created_at',{ascending:false}).limit(50);if(result.error)throw result.error;
 const contexts=new Map<string,any>();
 const applications=[];
 for(const row of (result.data||[]) as any[]){
  const projected=publicApplication(row,role);
  if(role==='job_seeker'){applications.push(projected);continue;}
  let allowed=false;
  try{let context=contexts.get(row.job_id);if(!context){context=await miniCandidateContext(client,user,row.job_id);contexts.set(row.job_id,context);}
   if(context.unlocked&&row.resume_id){const eligible=await miniCandidateRows(client,context,row.resume_id);allowed=eligible.some(m=>m.row.id===row.resume_id);}
  }catch{/* Missing proof must never reveal candidate data. */}
  if(allowed)applications.push(projected);
  else applications.push({id:projected.id,job_id:projected.job_id,status:projected.status,created_at:projected.created_at,jobs:projected.jobs,locked:true});
 }
 return accountResult({applications});
}catch(e){return accountFailure(e);}}
