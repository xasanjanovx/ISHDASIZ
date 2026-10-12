import {NextRequest} from 'next/server';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {getAuthClient} from '@/lib/auth/server';
import {availableJobs,JOB_CARD_FIELDS,publicJobCard,publicJobDetail,requirePublicJob} from '@/lib/public-job';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,client=getAuthClient(),job=await requirePublicJob(client,id,true);let similar:any[]=[],similarError=false;
 if(job.category_id){try{const result=await client.from('jobs').select(JOB_CARD_FIELDS).eq('category_id',job.category_id).neq('id',id).eq('is_active',true).or('status.eq.active,status.eq.published,status.eq.open,status.is.null').order('created_at',{ascending:false}).limit(20);if(result.error)throw result.error;similar=(await availableJobs(client,result.data||[])).slice(0,4).map(publicJobCard);}catch{similarError=true;}}
 return accountResult({job:publicJobDetail(job),similar,similarError});
}catch(error){return accountFailure(error);}}
