import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountError,isUuid} from '@/lib/auth/account';
import {miniMatch} from './matching';
export async function miniCandidateAccess(client:SupabaseClient,user:any,id:string){
 const result=await client.rpc('ishdasiz_mini_app_candidate_access',{p_user:user.id,p_version:user.session_version??0,p_job:id});
 // A deployment missing the migration must fail closed.
 return !result.error&&result.data===true;
}
export async function miniCandidateContext(client:SupabaseClient,user:any,id:string){
 if(!isUuid(id))throw new AccountError(404,'Vakansiya topilmadi');
 const own=await client.from('mini_app_records').select('metadata').eq('id',id).eq('kind','vacancy').eq('user_id',user.id).maybeSingle();
 if(own.error)throw new AccountError(503,'Nomzodlar xizmati vaqtincha mavjud emas');
 if(!own.data)throw new AccountError(404,'O‘z vakansiyangizni tanlang');
 const job=await client.from('jobs').select('id,title_uz,title_ru,category_id,region_id,district_id,salary_min,salary_max,work_mode,employment_type,experience,education_level,latitude,longitude').eq('id',id).eq('ishdasiz_job_available',true).maybeSingle();
 if(job.error)throw job.error;if(!job.data)throw new AccountError(404,'Vakansiya faol emas');
 return {job:job.data,metadata:own.data.metadata,ownerId:user.id,unlocked:await miniCandidateAccess(client,user,id)};
}
export async function miniCandidateRows(client:SupabaseClient,context:Awaited<ReturnType<typeof miniCandidateContext>>,resumeId?:string){
 let query=client.from('resumes').select('id,user_id,title,full_name,phone,about,skills,region_id,district_id,experience,education_level,employment_type,expected_salary_min,expected_salary_max,regions(name_uz),districts(name_uz)').eq('ishdasiz_resume_available',true).neq('user_id',context.ownerId);
 if(resumeId)query=query.eq('id',resumeId);
 else if(context.job.category_id)query=query.eq('category_id',context.job.category_id);
 const result=await query.order('created_at',{ascending:false}).limit(300);if(result.error)throw result.error;
 const rows=result.data||[];if(!rows.length)return [];
 const meta=await client.from('mini_app_records').select('id,metadata').eq('kind','resume').in('id',rows.map(r=>r.id));if(meta.error)throw meta.error;
 return rows.flatMap(row=>{const match=miniMatch(context.job,row,context.metadata,meta.data.find(m=>m.id===row.id)?.metadata||{});return match?[{row,...match}]:[];})
 .sort((a,b)=>Number(b.exact)-Number(a.exact)||(a.distanceKm??Infinity)-(b.distanceKm??Infinity));
}
