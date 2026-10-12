import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountError,isUuid} from './auth/account';
import {availableJobs,JOB_CARD_FIELDS,publicJobCard,requirePublicJob} from './public-job';
const relation=(value:any)=>Array.isArray(value)?value[0]||null:value||null;
const stamp=(value:unknown)=>value===null||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const encode=(row:any,date:string)=>Buffer.from(JSON.stringify({id:row.id,at:row[date]??null})).toString('base64url');
function decode(value:string){try{if(value.length>400||!/^[\w-]+$/.test(value))throw new Error();const parsed=JSON.parse(Buffer.from(value,'base64url').toString());if(!isUuid(parsed?.id)||!stamp(parsed.at))throw new Error();return parsed as {id:string;at:string|null};}catch{throw new AccountError(400,'Некорректная страница / Sahifa noto‘g‘ri');}}
export async function savedJobsPage(client:SupabaseClient,userId:string,kind:'favorites'|'history',before:string|null,visibleHistory=true){
 const table=kind==='favorites'?'favorites':'view_history',date=kind==='favorites'?'created_at':'viewed_at';
 let query=client.from(table).select(`id,job_id,${date},jobs(${JOB_CARD_FIELDS})`).eq('user_id',userId);
 if(kind==='history'&&visibleHistory)query=query.is('hidden_batch_id',null);
 if(before){
  const observed=decode(before);
  const result=await client.from(table).select(`id,${date}`).eq('user_id',userId).eq('id',observed.id).maybeSingle();if(result.error)throw result.error;const cursor=result.data as any;
  if(!cursor||(cursor[date]??null)!==observed.at)throw new AccountError(409,'Список изменился. Обновите страницу / Ro‘yxat o‘zgardi. Sahifani yangilang');
  query=cursor[date]==null?query.is(date,null).lt('id',cursor.id):query.or(`${date}.lt.${cursor[date]},and(${date}.eq.${cursor[date]},id.lt.${cursor.id}),${date}.is.null`);
 }
 const result=await query.order(date,{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(51);
 if(result.error){if(kind==='history'&&visibleHistory&&['42703','PGRST204'].includes(result.error.code)&&/hidden_batch_id/.test(result.error.message))return savedJobsPage(client,userId,kind,before,false);throw result.error;}
 const rows=((result.data||[]) as any[]).slice(0,50),jobs=rows.map(row=>relation(row.jobs)).filter(Boolean),visible=new Set((await availableJobs(client,jobs)).map(job=>job.id));
 return {items:rows.map(row=>({id:row.id,job_id:row.job_id,at:row[date]??null,job:relation(row.jobs)&&visible.has(relation(row.jobs).id)?publicJobCard(relation(row.jobs)):null})),nextCursor:(result.data?.length||0)>50?encode(rows[rows.length-1],date):null,supportsClear:kind==='history'?visibleHistory:undefined};
}
export async function setFavorite(client:SupabaseClient,userId:string,jobId:unknown,favorite:unknown,epoch=0){
 if(!isUuid(jobId)||typeof favorite!=='boolean')throw new AccountError(400,'Выберите вакансию / Vakansiyani tanlang');
 if(favorite)await requirePublicJob(client,jobId);
 const result=await client.rpc('ishdasiz_set_job_favorite',{p_user_id:userId,p_session_version:epoch,p_job_id:jobId,p_favorite:favorite});
 if(result.error?.code==='P0002')throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');if(result.error?.code==='42501')throw new AccountError(401,'Войдите повторно / Qayta kiring');if(result.error)throw result.error;
 if(result.data!==favorite)throw new Error('Favorite result unavailable');
 return {favorite};
}
