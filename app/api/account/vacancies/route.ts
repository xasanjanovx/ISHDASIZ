import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,checkSameOrigin,isUuid,requireAccount} from '@/lib/auth/account';
import {ownVacancy,vacancyApplicationCounts,vacancyEmployer,vacancyInput,vacancyQuery,vacancyResult,vacancyStats,VACANCY_EDIT_FIELDS} from '@/lib/account-vacancies';
import {employerJobScope} from '@/lib/account-jobs';
export async function GET(request:NextRequest) {
 try {
  const {client,user}=await requireAccount(request),employer=await vacancyEmployer(client,user.id);
  const state=request.nextUrl.searchParams.get('state')||'all',before=request.nextUrl.searchParams.get('before');
  const cursor=before?await ownVacancy(client,user.id,employer.id,before):undefined;
  const result=await vacancyQuery(client,user.id,employer.id,`${VACANCY_EDIT_FIELDS},categories(name_uz,name_ru),regions(name_uz,name_ru),districts(name_uz,name_ru)`,state,cursor)
   .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
  if(result.error)throw result.error;
  const rows=((result.data||[]) as any[]).slice(0,50);
  const [countResult,statsResult]=await Promise.allSettled([vacancyApplicationCounts(client,rows.map(row=>row.id)),vacancyStats(client,user.id,employer.id)]);
  const vacancies=rows.map(row=>({...vacancyResult(row),categories:row.categories,regions:row.regions,districts:row.districts,applications_count:countResult.status==='fulfilled'?countResult.value[row.id]:null}));
  return accountResult({vacancies,nextCursor:(result.data?.length||0)>50?vacancies.at(-1)?.id:null,stats:statsResult.status==='fulfilled'?statsResult.value:null,counts_error:countResult.status==='rejected',stats_error:statsResult.status==='rejected'});
 } catch(error){return accountFailure(error);}
}
export async function POST(request:NextRequest) {
 try {
  checkSameOrigin(request);const {client,user}=await requireAccount(request),employer=await vacancyEmployer(client,user.id);
  const body=await request.json().catch(()=>null);
  if(!isUuid(body?.request_id)||!['active','draft'].includes(body?.status))throw new AccountError(400,'Проверьте идентификатор и статус / Identifikator va holatni tekshiring');
  const payload={...await vacancyInput(client,body,employer,undefined,body.status==='active'),status:body.status,is_active:body.status==='active'};
  const existing=await client.from('jobs').select(`${VACANCY_EDIT_FIELDS},employer_id,user_id,created_by`).eq('id',body.request_id).or(employerJobScope(user.id,employer.id)).maybeSingle();
  if(existing.error)throw existing.error;
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const same=(row:any)=>row.employer_id===employer.id&&row.user_id===user.id&&Object.entries(payload).every(([key,value])=>JSON.stringify(canonical(row[key]??null))===JSON.stringify(canonical(value??null)));
  if(existing.data){if(!same(existing.data))throw new AccountError(409,'Вакансия уже сохранена. Откройте список / Vakansiya saqlangan. Ro‘yxatni oching');return accountResult({vacancy:vacancyResult(existing.data)},201);}
  const result=await client.from('jobs').insert({...payload,id:body.request_id,employer_id:employer.id,user_id:user.id,created_by:user.id,source:'website'}).select(VACANCY_EDIT_FIELDS).single();
  if(result.error?.code==='23505') {
   const row=await ownVacancy(client,user.id,employer.id,body.request_id);
   if(same(row))return accountResult({vacancy:vacancyResult(row)},201);
   throw new AccountError(409,'Вакансия уже сохранена. Откройте список / Vakansiya saqlangan. Ro‘yxatni oching');
  }
  if(result.error)throw result.error;if(!result.data)throw new Error('Save unavailable');
  return accountResult({vacancy:vacancyResult(result.data)},201);
 } catch(error){return accountFailure(error);}
}
