import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountError,isUuid} from './auth/account';
import {adminDistrict,type AdminIdentity} from './auth/admin';
import {vacancyFilter,vacancyInput,vacancyResult,VACANCY_EDIT_FIELDS} from './account-vacancies';
import {validResumeVersion} from './account-resumes';
import {availableJobs} from './public-job';
const DETAIL=`${VACANCY_EDIT_FIELDS},source_status,is_imported,employer_id,user_id,created_by,phone,email,employer_profiles(user_id)`;
export function adminVacancyQuery(client:SupabaseClient,profile:AdminIdentity,fields:string,state='all',cursor?:any,head=false){
 const district=adminDistrict(profile);let query=client.from('jobs').select(fields,{count:'exact',head});if(district)query=query.eq('district_id',district);
 const conditions:string[]=[];const filter=vacancyFilter(state);if(filter)conditions.push(filter);
 if(cursor)conditions.push(cursor.created_at==null?`and(created_at.is.null,id.lt.${cursor.id})`:`or(created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}),created_at.is.null)`);
 if(conditions.length)query=query.or(`and(${conditions.join(',')})`);return query;
}
export async function adminVacancy(client:SupabaseClient,profile:AdminIdentity,id:unknown){
 if(!isUuid(id))throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');
 const result=await adminVacancyQuery(client,profile,DETAIL).eq('id',id).maybeSingle();
 if(result.error)throw result.error;if(!result.data)throw new AccountError(404,'Вакансия недоступна в вашем районе / Vakansiya sizning tumaningizda mavjud emas');return result.data as any;
}
export async function adminVacancyPrefill(client:SupabaseClient,profile:AdminIdentity){
 const district=adminDistrict(profile);if(!district)return {company_name:'',region_id:null,district_id:null};
 const row=await client.from('districts').select('id,region_id').eq('id',district).maybeSingle();if(row.error)throw row.error;if(!row.data)throw new AccountError(403,'Назначенный район недоступен / Belgilangan tuman mavjud emas');
 return {company_name:'',region_id:row.data.region_id,district_id:district};
}
async function write(client:SupabaseClient,profile:AdminIdentity,id:string,action:string,payload:any,version:string|null){
 const result=await client.rpc('ishdasiz_admin_write_vacancy',{p_admin_id:profile.id,p_job_id:id,p_action:action,p_payload:payload,p_expected_version:version});
 if(result.error?.code==='42501')throw new AccountError(403,'Права изменились или аккаунт работодателя закрыт. Обновите доступ / Huquqlar o‘zgardi yoki ish beruvchi akkaunti yopilgan. Kirishni yangilang');
 if(result.error?.code==='P0002')throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');
 if(['40001','23505'].includes(result.error?.code||''))throw new AccountError(409,'Вакансия изменилась. Загрузите актуальную версию / Vakansiya o‘zgardi. Yangi versiyani yuklang');
 if(result.error)throw result.error;const row=Array.isArray(result.data)?result.data[0]:result.data;
 if(!row?.id||row.id!==id)throw new Error('Vacancy result unavailable');return vacancyResult(row);
}
async function input(client:SupabaseClient,profile:AdminIdentity,body:any,saved?:any,publish=true){
 const payload=await vacancyInput(client,body,{company_name:body?.company_name},saved,publish),district=adminDistrict(profile);
 if(district&&payload.district_id!==district)throw new AccountError(403,'Выберите назначенный вам район / Sizga belgilangan tumanni tanlang');
 return payload;
}
export async function createAdminVacancy(client:SupabaseClient,profile:AdminIdentity,body:any){
 if(!isUuid(body?.request_id)||!['active','draft'].includes(body?.status))throw new AccountError(400,'Проверьте идентификатор и статус / Identifikator va holatni tekshiring');
 const payload={...await input(client,profile,body,undefined,body.status==='active'),status:body.status,is_active:body.status==='active'};
 return write(client,profile,body.request_id,'create',payload,null);
}
export async function updateAdminVacancy(client:SupabaseClient,profile:AdminIdentity,id:unknown,body:any,edit=false){
 if(!body||!validResumeVersion(body.expected_updated_at))throw new AccountError(400,'Обновите вакансию перед сохранением / Saqlashdan oldin vakansiyani yangilang');
 const saved=await adminVacancy(client,profile,id);if((saved.updated_at??null)!==body.expected_updated_at)throw new AccountError(409,'Вакансия изменилась. Обновите данные / Vakansiya o‘zgardi. Ma’lumotlarni yangilang');
 let payload:any={},action=edit?'edit':body.action;
 if(edit){if(saved.status==='archived')throw new AccountError(409,'Сначала восстановите вакансию из архива / Avval vakansiyani arxivdan tiklang');payload=await input(client,profile,body,saved,saved.is_active===true&&[null,'active','published','open'].includes(saved.status??null));}
 else {
  if(!['publish','hide','filled','archive','restore'].includes(action))throw new AccountError(400,'Выберите действие / Amalni tanlang');
  if(saved.status==='archived'&&action!=='restore'||saved.status!=='archived'&&action==='restore')throw new AccountError(409,'Статус изменился. Обновите вакансию / Holat o‘zgardi. Vakansiyani yangilang');
  if(action==='publish'){
   // Availability includes the assigned company's account. Temporarily use active flags for this check.
   if(!(await availableJobs(client,[{...saved,status:'active',is_active:true}])).length)throw new AccountError(409,'Публикация недоступна: проверьте источник и аккаунт работодателя / E’lon mavjud emas: manba va ish beruvchi akkauntini tekshiring');
   payload=await input(client,profile,{...vacancyResult(saved),company_name:saved.company_name},saved);
  }
 }
 return write(client,profile,saved.id,action,payload,body.expected_updated_at);
}
