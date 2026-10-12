import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError, isUuid } from './auth/account';
import { normalizePhone } from './auth/server';
import { employerJobScope } from './account-jobs';
import { profileInput } from './account-profile';
import { validResumeVersion } from './account-resumes';
import { resumeLanguages } from './resume-languages';
import { resumeSkills } from './resume-api';

export const VACANCY_EDIT_FIELDS = 'id,title_uz,title_ru,description_uz,description_ru,company_name,category_id,region_id,district_id,salary_min,salary_max,employment_type,latitude,longitude,address,contact_phone,contact_telegram,requirements_uz,requirements_ru,benefits,experience,education_level,gender,age_min,age_max,languages,is_for_students,is_for_disabled,is_for_women,payment_type,work_mode,skills,status,is_active,created_at,updated_at,views_count';
const owners = 'employer_id,user_id,created_by';
const invalid = (ru: string, uz: string): never => { throw new AccountError(400,`${ru} / ${uz}`); };
export async function vacancyEmployer(client: SupabaseClient, userId: string) {
  const result = await client.from('employer_profiles').select('id,company_name,phone,telegram,region_id,district_id,address').eq('user_id',userId).maybeSingle();
  if(result.error) throw result.error;
  if(!result.data) throw new AccountError(403,'Создайте профиль работодателя / Ish beruvchi profilini yarating');
  return result.data as any;
}
export async function ownVacancy(client: SupabaseClient,userId:string,employerId:string,id:unknown) {
  if(!isUuid(id)) throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');
  const result=await client.from('jobs').select(`${VACANCY_EDIT_FIELDS},${owners},phone,email`).eq('id',id).or(employerJobScope(userId,employerId)).maybeSingle();
  if(result.error) throw result.error;
  if(!result.data) throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');
  return result.data as any;
}
export function vacancyResult(row:any) {
  const result:any={};for(const key of VACANCY_EDIT_FIELDS.split(',')) result[key]=row[key]??null;
  result.contact_phone=row.contact_phone || row.phone || null;
  result.languages=resumeLanguages(row.languages).map(({name,level})=>({language:name,level:level || ''}));
  result.skills=resumeSkills(row.skills);
  return result;
}
function text(value:unknown,max:number,required=false):string|null {
  if(value==null&&!required)return null;
  if(typeof value!=='string'||value.length>max||required&&!value.trim())return invalid('Проверьте текстовые поля и их длину','Matn maydonlari va uzunligini tekshiring');
  return value.trim()||null;
}
function integer(value:unknown,max=2147483647):number|null {
  if(value==null||value==='')return null;
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)return invalid('Проверьте числовые поля','Son maydonlarini tekshiring');
  return value;
}
function option(value:unknown,values:string[],fallback:string) {
  if(value==null||value==='')return fallback;
  if(typeof value!=='string'||!values.includes(value))return invalid('Выберите варианты из списка','Variantlarni ro‘yxatdan tanlang');
  return value;
}
export async function vacancyInput(client:SupabaseClient,body:any,employer:any,saved?:any,publish=true) {
  if(!body||typeof body!=='object'||Array.isArray(body))return invalid('Некорректная форма','Forma noto‘g‘ri');
  const payload:any={company_name:text(employer.company_name,255,true)};
  payload.title_uz=text(body.title_uz,255);payload.title_ru=text(body.title_ru,255);
  if(!payload.title_uz&&!payload.title_ru)invalid('Укажите название вакансии хотя бы на одном языке','Vakansiya nomini kamida bitta tilda kiriting');
  payload.title_uz ||= payload.title_ru;payload.title_ru ||= payload.title_uz;
  for(const key of ['description_uz','description_ru','requirements_uz','requirements_ru'])payload[key]=text(body[key],20000);
  if(publish&&!payload.description_uz&&!payload.description_ru)invalid('Добавьте описание вакансии','Vakansiya tavsifini kiriting');
  payload.description_uz ||= payload.description_ru||'';payload.description_ru ||= payload.description_uz||'';
  payload.benefits=text(body.benefits,10000);payload.address=text(body.address,1000);
  payload.salary_min=integer(body.salary_min);payload.salary_max=integer(body.salary_max);
  if(payload.salary_min!==null&&payload.salary_max!==null&&payload.salary_min>payload.salary_max)invalid('Минимальная зарплата больше максимальной','Eng kam maosh eng ko‘p maoshdan katta');
  payload.age_min=integer(body.age_min,100);payload.age_max=integer(body.age_max,100);
  if([payload.age_min,payload.age_max].some(value=>value!==null&&value<16)||payload.age_min!==null&&payload.age_max!==null&&payload.age_min>payload.age_max)
    invalid('Проверьте диапазон возраста (16–100)','Yosh oralig‘ini tekshiring (16–100)');
  const choose=(key:string,values:string[],fallback:string)=>saved?.[key]!=null&&body[key]===String(saved[key])?saved[key]:option(body[key],values,fallback);
  payload.employment_type=choose('employment_type',['full_time','part_time','contract','internship','remote'],'full_time');
  payload.work_mode=choose('work_mode',['onsite','remote','hybrid'],'onsite');
  // Live jobs.payment_type is an integer with the same values as the public catalog.
  payload.payment_type=saved?.payment_type!=null&&String(body.payment_type)===String(saved.payment_type)?saved.payment_type:Number(option(body.payment_type==null?null:String(body.payment_type),['1','2','3','4'],'3'));
  payload.experience=choose('experience',['no_experience','1_year','1_3_years','3_5_years','5_plus'],'no_experience');
  payload.education_level=choose('education_level',['any','secondary','vocational','higher','master'],'any');
  payload.gender=choose('gender',['any','male','female'],'any');
  for(const key of ['is_for_students','is_for_disabled','is_for_women']) {
    if(body[key]!=null&&typeof body[key]!=='boolean')invalid('Проверьте отметки условий работы','Ish shartlari belgilarini tekshiring');
    payload[key]=body[key]===true;
  }
  payload.contact_phone=body.contact_phone?normalizePhone(body.contact_phone):null;
  if(!payload.contact_phone&&(publish||body.contact_phone))invalid('Введите контактный телефон +998 и 9 цифр','+998 va 9 raqamli aloqa telefonini kiriting');
  const contacts=await profileInput(client,'employer',{telegram:body.contact_telegram||null,region_id:body.region_id??null,district_id:body.district_id??null},{});
  payload.contact_telegram=contacts.telegram;payload.region_id=contacts.region_id;payload.district_id=contacts.district_id;
  if(publish&&!payload.region_id&&payload.work_mode!=='remote')invalid('Выберите регион места работы','Ish joyi viloyatini tanlang');
  payload.category_id=body.category_id||null;
  if(payload.category_id||publish) {
    if(!isUuid(payload.category_id))invalid('Выберите отрасль из списка','Soha ro‘yxatidan tanlang');
    const category=await client.from('categories').select('id').eq('id',payload.category_id).maybeSingle();
    if(category.error)throw category.error;
    if(!category.data)invalid('Выбранная отрасль недоступна','Tanlangan soha mavjud emas');
  }
  const coordinates=[body.latitude,body.longitude].map(value=>value===''||value==null?null:value);
  if(coordinates.some(value=>value!==null)&&(!coordinates.every(value=>typeof value==='number'&&Number.isFinite(value))||Math.abs(coordinates[0] as number)>90||Math.abs(coordinates[1] as number)>180))
    invalid('Укажите обе координаты или уберите отметку на карте','Ikkala koordinatani kiriting yoki xarita belgisini olib tashlang');
  [payload.latitude,payload.longitude]=coordinates;
  const prior=saved?vacancyResult(saved):null;
  if(prior&&JSON.stringify(body.skills)===JSON.stringify(prior.skills))payload.skills=saved.skills;
  else {
    if(body.skills!=null&&(!Array.isArray(body.skills)||body.skills.length>50||body.skills.some((value:any)=>typeof value!=='string'||!value.trim()||value.length>100)))invalid('Проверьте навыки (до 50)','Ko‘nikmalarni tekshiring (50 tagacha)');
    payload.skills=Array.from(new Set<string>((body.skills||[]).map((value:string)=>value.trim())));
  }
  if(prior&&JSON.stringify(body.languages)===JSON.stringify(prior.languages))payload.languages=saved.languages;
  else {
    if(body.languages!=null&&(!Array.isArray(body.languages)||body.languages.length>20))invalid('Проверьте список языков','Tillar ro‘yxatini tekshiring');
    payload.languages=(body.languages||[]).map((row:any)=>{
      const language=text(row?.language,100,true);
      const unchanged=prior?.languages.some((item:any)=>item.language===row?.language&&item.level===row?.level);
      const level=unchanged?row.level:option(row?.level,['A1','A2','B1','B2','C1','C2','native','fluent','basic','intermediate','advanced'],'');
      return {language,level};
    });
  }
  return payload;
}
export function vacancyFilter(state:string) {
  if(state==='all')return '';
  if(state==='active')return 'and(or(status.is.null,status.eq.active,status.eq.published,status.eq.open),is_active.eq.true)';
  if(state==='filled'||state==='archived')return `status.eq.${state}`;
  if(state==='draft')return 'and(or(is_active.eq.false,is_active.is.null,and(status.neq.active,status.neq.published,status.neq.open)),or(status.is.null,and(status.neq.filled,status.neq.archived)))';
  return invalid('Некорректный фильтр','Filtr noto‘g‘ri');
}
export function vacancyQuery(client:SupabaseClient,userId:string,employerId:string,fields:string,state='all',cursor?:any,head=false) {
  const conditions=[`or(${employerJobScope(userId,employerId)})`];
  const filter=vacancyFilter(state);if(filter)conditions.push(filter);
  if(cursor)conditions.push(`or(created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}))`);
  // One root .or call: a second one would overwrite the ownership condition.
  return client.from('jobs').select(fields,{count:'exact',head}).or(`and(${conditions.join(',')})`);
}
export async function vacancyStats(client:SupabaseClient,userId:string,employerId:string) {
  const states=['all','active','draft','filled','archived'];
  const results=await Promise.all(states.map(state=>vacancyQuery(client,userId,employerId,'id',state,undefined,true)));
  const stats:any={};for(let index=0;index<results.length;index++) {if(results[index].error)throw results[index].error;if(results[index].count==null)throw new Error('Count unavailable');stats[states[index]]=results[index].count;}
  return stats;
}
export async function vacancyApplicationCounts(client:SupabaseClient,ids:string[]) {
  const counts:Record<string,number>=Object.fromEntries(ids.map(id=>[id,0]));
  if(!ids.length)return counts;
  for(let offset=0;;offset+=500) {
    const result=await client.from('job_applications').select('job_id').in('job_id',ids).order('id').range(offset,offset+499);
    if(result.error)throw result.error;
    for(const row of result.data||[])if(row.job_id in counts)counts[row.job_id]++;
    if((result.data?.length||0)<500)return counts;
  }
}
export async function updateVacancy(client:SupabaseClient,userId:string,employer:any,id:unknown,body:any,edit=false) {
  if(!body||!validResumeVersion(body.expected_updated_at))invalid('Обновите вакансию перед сохранением','Saqlashdan oldin vakansiyani yangilang');
  const saved=await ownVacancy(client,userId,employer.id,id);
  if((saved.updated_at??null)!==body.expected_updated_at)throw new AccountError(409,'Вакансия изменилась. Обновите данные / Vakansiya o‘zgardi. Ma’lumotlarni yangilang');
  let patch:any;
  if(edit)patch=await vacancyInput(client,body,employer,saved,saved.is_active===true&&[null,'active','published','open'].includes(saved.status??null));
  else {
    if(!['publish','hide','filled','archive','restore'].includes(body.action))invalid('Некорректное действие','Amal noto‘g‘ri');
    if(saved.status==='archived'&&body.action!=='restore')throw new AccountError(409,'Сначала восстановите вакансию из архива / Avval vakansiyani arxivdan tiklang');
    if(saved.status!=='archived'&&body.action==='restore')throw new AccountError(409,'Вакансия уже восстановлена / Vakansiya tiklangan');
    if(body.action==='publish') {
      const input=await vacancyInput(client,vacancyResult(saved),employer,saved);
      patch={...input,status:'active',is_active:true};
    } else patch={status:body.action==='filled'?'filled':body.action==='archive'?'archived':'draft',is_active:false};
  }
  if(edit&&saved.status==='archived')throw new AccountError(409,'Сначала восстановите вакансию из архива / Avval vakansiyani arxivdan tiklang');
  patch.updated_at=new Date(Math.max(Date.now(),Date.parse(saved.updated_at||'')+1||0)).toISOString();
  let query=client.from('jobs').update(patch).eq('id',saved.id).or(employerJobScope(userId,employer.id));
  query=saved.updated_at==null?query.is('updated_at',null):query.eq('updated_at',saved.updated_at);
  // Also reject assignment changes made by old writers that did not advance time.
  for(const key of owners.split(','))query=saved[key]==null?query.is(key,null):query.eq(key,saved[key]);
  const result=await query.select(VACANCY_EDIT_FIELDS).maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw new AccountError(409,'Вакансия изменилась или передана другому владельцу / Vakansiya o‘zgargan yoki boshqa egaga berilgan');
  return vacancyResult(result.data);
}
