import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountError,isUuid} from './auth/account';
export const JOB_CARD_FIELDS='id,title_uz,title_ru,company_name,salary_min,salary_max,employment_type,created_at,region_id,district_id,status,is_active,source_status,employer_id,user_id,created_by,regions(name_uz,name_ru),districts(name_uz,name_ru),employer_profiles(user_id)';
const relation=(value:any)=>Array.isArray(value)?value[0]||null:value||null;
export function isPublishedJob(job:any){return Boolean(job&&job.is_active===true&&[null,undefined,'active','published','open'].includes(job.status)&&!['filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed'].includes(job.source_status));}
export async function openJobOwners(client:SupabaseClient,jobs:any[]) {
 const owner=(job:any)=>job.employer_id?relation(job.employer_profiles)?.user_id:job.user_id||job.created_by||null;
 const ids=Array.from(new Set<string>(jobs.map(owner).filter(Boolean)));const open=new Set<string>();
 for(let offset=0;offset<ids.length;offset+=100){
  let result:any=await client.from('users').select('id,closed_at').in('id',ids.slice(offset,offset+100));
  if(result.error&&['42703','PGRST204'].includes(result.error.code)&&/closed_at/.test(result.error.message))result=await client.from('users').select('id').in('id',ids.slice(offset,offset+100));
  if(result.error)throw result.error;for(const row of (result.data||[]) as any[])if(!row.closed_at)open.add(row.id);
 }
 return (job:any)=>{const id=owner(job);return job.employer_id&&!id?false:id?open.has(id):true;};
}
export async function availableJobs(client:SupabaseClient,jobs:any[]) {
 const candidates=jobs.filter(isPublishedJob),isOpen=await openJobOwners(client,candidates);return candidates.filter(isOpen);
}
export function publicJobCard(row:any) {
 const keys=['id','title_uz','title_ru','company_name','salary_min','salary_max','employment_type','created_at','region_id','district_id'];
 return {...Object.fromEntries(keys.map(key=>[key,row[key]??null])),regions:relation(row.regions),districts:relation(row.districts)};
}
export async function requirePublicJob(client:SupabaseClient,id:unknown,detail=false) {
 if(!isUuid(id))throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');
 // All columns stay on the server. Only the explicit public projections are returned.
 const result=await client.from('jobs').select(detail?'*,categories(name_uz,name_ru),regions(name_uz,name_ru),districts(name_uz,name_ru,regions(name_uz,name_ru)),employer_profiles(user_id)':JOB_CARD_FIELDS).eq('id',id).maybeSingle();
 if(result.error)throw result.error;if(!result.data||!(await availableJobs(client,[result.data])).length)throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');return result.data as any;
}
export function publicJobDetail(row:any) {
 const fields='id,title_uz,title_ru,description_uz,description_ru,company_name,category_id,region_id,district_id,salary_min,salary_max,employment_type,latitude,longitude,address,phone,email,contact_phone,contact_telegram,contact_email,requirements_uz,requirements_ru,benefits,experience,education_level,gender,age_min,age_max,languages,skills,is_for_students,is_for_graduates,is_for_disabled,is_for_women,payment_type,work_mode,working_days,working_hours,working_schedule,vacancy_count,region_name,district_name,is_imported,created_at,updated_at,views_count,hr_name';
 const result:any=Object.fromEntries(fields.split(',').map(key=>[key,row[key]??null]));result.categories=relation(row.categories);result.regions=relation(row.regions);result.districts=relation(row.districts);
 // Import metadata is projected rather than exposing arbitrary original records.
 const raw=row.raw_source_json&&typeof row.raw_source_json==='object'?row.raw_source_json:{};
 const rawKeys='info,html_responsibilities,html_requirements,html_conditions,work_experiance,min_education,education_level,payment_type,work_mode,work_type,working_days_id,working_hours,working_time_from,working_time_to,position_name,vacancy_count,test_period_id,test_period,address,hr_name';
 result.raw_source_json=Object.fromEntries(rawKeys.split(',').filter(key=>typeof raw[key]==='string'||typeof raw[key]==='number').map(key=>[key,raw[key]]));
 const sections=(value:any)=>Object.fromEntries(['qulayliklar','talablar','ish_vazifalari'].map(key=>[key,Array.isArray(value?.[key])?value[key].filter((item:any)=>typeof item==='string').slice(0,100):[]]));
 result.sections=sections(row.sections||raw.sections);
 const scalar=(value:any)=>typeof value==='string'||typeof value==='number'?value:undefined;
 const skills=(value:any)=>Array.isArray(value)?value.slice(0,100).map((item:any)=>typeof item==='string'?{name:item}:{name:scalar(item?.name),skill_name:scalar(item?.skill_name),level:scalar(item?.level)}):[];
 const languages=(value:any)=>Array.isArray(value)?value.slice(0,30).map((item:any)=>typeof item==='string'?{name:item}:typeof item==='number'?{language:item}:{language:scalar(item?.language),id:scalar(item?.id),name:scalar(item?.name),level:scalar(item?.level)}):[];
 result.skills=skills(row.skills);result.languages=languages(row.languages);
 result.raw_source_json.skills_details=skills(raw.skills_details?.length?raw.skills_details:row.skills);
 result.raw_source_json.languages=languages(raw.languages?.length?raw.languages:row.languages);
 if(typeof raw.hr?.fio==='string')result.raw_source_json.hr={fio:raw.hr.fio};
 return result;
}
