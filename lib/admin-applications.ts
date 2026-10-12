import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountError,isUuid} from './auth/account';
import {adminDistrict,type AdminIdentity} from './auth/admin';
import {APPLICATION_STATUS_ALIASES,filterApplications,publicApplication} from './account-applications';
import {APPLICATION_STATUSES} from './application-status';
export function adminApplicationQuery(client:SupabaseClient,profile:AdminIdentity,head=false){
 const district=adminDistrict(profile);
 const fields=head?'id':'id,job_id,user_id,full_name,phone,email,message,status,created_at,viewed_at,responded_at,is_seen_by_job_seeker,resume_id,interview_date,interview_address,employer_message,rejection_reason,resumes(id,user_id,status,title,full_name,about,skills,experience)';
 let query=client.from('job_applications').select(`${fields},jobs!inner(id,title_uz,title_ru,company_name,salary_min,salary_max,district_id,regions(name_uz,name_ru),districts(name_uz,name_ru))`,{count:'exact',head});
 if(district)query=query.eq('jobs.district_id',district);return query;
}
function filter(query:any,options:{status:string;job?:string|null;search?:string}){
 query=filterApplications(query,options.status);
 if(options.job){if(!isUuid(options.job))throw new AccountError(400,'Выберите вакансию / Vakansiyani tanlang');query=query.eq('job_id',options.job);}
 if(options.search){
  if(options.search.length>100)throw new AccountError(400,'Поиск до 100 символов / Qidiruv 100 ta belgigacha');
  // Escape a literal regex, then quote the PostgREST value. User text cannot
  // introduce operators, wildcard searches or nested logical filters.
  const literal=options.search.replace(/[.*+?^\$\{\}()|[\]\\]/g,'\\$&');
  const value=JSON.stringify(literal);
  query=query.or(['full_name','phone','email','message'].map(key=>key+'.imatch.'+value).join(','));
 }
 return query;
}
export async function adminApplications(client:SupabaseClient,profile:AdminIdentity,options:{status:string;job?:string|null;search?:string;page:number}){
 if(!Number.isSafeInteger(options.page)||options.page<0||options.page>100000)throw new AccountError(400,'Некорректная страница / Sahifa noto‘g‘ri');
 const result=await filter(adminApplicationQuery(client,profile),options).order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range(options.page*50,options.page*50+49);
 if(result.error||result.count==null)throw result.error||new Error('Application count unavailable');
 return {applications:(result.data||[]).map((row:any)=>publicApplication(row,'employer')),total:result.count,page:options.page,hasMore:(options.page+1)*50<result.count};
}
export async function adminApplicationStats(client:SupabaseClient,profile:AdminIdentity){
 const results=await Promise.all(['total',...APPLICATION_STATUSES].map(async key=>{
  let query=adminApplicationQuery(client,profile,true);if(key!=='total')query=query.in('status',APPLICATION_STATUS_ALIASES[key as keyof typeof APPLICATION_STATUS_ALIASES]);
  const result=await query;if(result.error||result.count==null)throw result.error||new Error('Application count unavailable');return [key,result.count];
 }));return Object.fromEntries(results);
}
