'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useLanguage} from '@/contexts/language-context';
import {AccountGate} from './account-gate';
import {ProfileLayout} from './profile-layout';
import {Button} from '@/components/ui/button';
import {Loader2} from '@/components/ui/icons';
import {accountApi,AccountApiError} from '@/lib/account-api';
import {formatSalary} from '@/lib/constants';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter} from '@/components/ui/alert-dialog';
type Kind='favorites'|'history';
type Item={id:string;job_id:string;at:string|null;job:Record<string,any>|null};
type Page={items:Item[];nextCursor:string|null;supportsClear?:boolean;undoId?:string|null};
export function savedJobsError(error:unknown,ru:boolean){
 const status=error instanceof AccountApiError?error.status:0;
 if(status===401)return ru?'Войдите повторно, чтобы продолжить.':'Davom etish uchun qayta kiring.';
 if(status===403)return ru?'Откройте профиль соискателя.':'Ish izlovchi profilini oching.';
 if(status===409)return ru?'Список изменился. Обновите его и повторите действие.':'Ro‘yxat o‘zgardi. Yangilang va amalni takrorlang.';
 return ru?'Не удалось загрузить или сохранить данные. Попробуйте ещё раз.':'Ma’lumotlarni yuklab yoki saqlab bo‘lmadi. Qayta urinib ko‘ring.';
}
export function SavedJobsPage({kind}:{kind:Kind}){return <AccountGate><SavedJobs key={kind} kind={kind}/></AccountGate>;}
function SavedJobs({kind}:{kind:Kind}){
 const {lang}=useLanguage(),ru=lang==='ru',history=kind==='history',url=`/api/account/${kind}`;
 const [revision,setRevision]=useState(0),[snapshot,setSnapshot]=useState<(Page&{key:number})|null>(null),[failure,setFailure]=useState<{key:number;error:unknown;more?:boolean}|null>(null);
 const [busy,setBusy]=useState<string|null>(null),[confirm,setConfirm]=useState(false),[undoId,setUndoId]=useState<string|null>(null);
 const alive=useRef(true),current=useRef(revision),lock=useRef(false);
 useLayoutEffect(()=>{current.current=revision;},[revision]);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{let cancelled=false;const controller=new AbortController();accountApi<Page>(url,{signal:controller.signal}).then(page=>{if(!cancelled){setSnapshot({...page,key:revision});setUndoId(page.undoId??null);}}).catch(error=>{if(!cancelled)setFailure({key:revision,error});});return()=>{cancelled=true;controller.abort();};},[url,revision]);
 const page=snapshot?.key===revision?snapshot:null,error=failure?.key===revision?failure:null;
 const refresh=()=>{setFailure(null);setRevision(value=>value+1);};
 const more=async()=>{if(lock.current||!page?.nextCursor)return;lock.current=true;setBusy('more');setFailure(null);try{
  const result=await accountApi<Page>(`${url}?before=${encodeURIComponent(page.nextCursor)}`);if(!alive.current||current.current!==revision)return;
  setSnapshot(previous=>previous?.key===revision?{...result,key:revision,items:Array.from(new Map([...previous.items,...result.items].map(item=>[item.id,item])).values())}:previous);
 }catch(error){if(alive.current&&current.current===revision)setFailure({key:revision,error,more:true});}finally{lock.current=false;if(alive.current&&current.current===revision)setBusy(null);}};
 const remove=async(item:Item)=>{if(lock.current)return;lock.current=true;setBusy(item.id);setFailure(null);try{
  const result=await accountApi<{favorite:boolean}>('/api/account/favorites',{method:'PUT',body:JSON.stringify({job_id:item.job_id,favorite:false})});if(!alive.current||current.current!==revision)return;if(result.favorite!==false)throw new AccountApiError(503);
  setSnapshot(previous=>previous?.key===revision?{...previous,items:previous.items.filter(row=>row.id!==item.id)}:previous);
 }catch(error){if(alive.current&&current.current===revision)setFailure({key:revision,error});}finally{lock.current=false;if(alive.current&&current.current===revision)setBusy(null);}};
 const clear=async(restore=false)=>{if(lock.current||restore&&!undoId)return;lock.current=true;setBusy('history');setFailure(null);try{
  const result=await accountApi<{undoId:string|null}>(url,{method:'PATCH',body:JSON.stringify({action:restore?'restore':'clear',undo_id:restore?undoId:undefined})});if(!alive.current||current.current!==revision)return;
  if(!restore&&typeof result.undoId!=='string'||restore&&result.undoId!==null)throw new AccountApiError(503);setUndoId(result.undoId);setConfirm(false);refresh();
 }catch(error){if(alive.current&&current.current===revision)setFailure({key:revision,error});}finally{lock.current=false;if(alive.current)setBusy(null);}};
 return <ProfileLayout userType="job_seeker"><div className="space-y-6">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-slate-950">{history?(ru?'История просмотров':'Ko‘rish tarixi'):(ru?'Избранные вакансии':'Sevimli vakansiyalar')}</h1><p className="mt-2 text-slate-500">{history?(ru?'Вернитесь к вакансиям, которые вы смотрели.':'Ko‘rgan vakansiyalaringizga qayting.'):(ru?'Вакансии, которые вы сохранили на сайте или в боте.':'Sayt yoki botda saqlagan vakansiyalaringiz.')}</p></div>{history&&page?.items.length&&page.supportsClear?<Button variant="outline" disabled={!!busy} onClick={()=>setConfirm(true)}>{ru?'Скрыть историю':'Tarixni yashirish'}</Button>:null}</div>
  {history&&undoId&&<div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"><p>{ru?'Прежняя история скрыта. Новые просмотры продолжают появляться.':'Oldingi tarix yashirildi. Yangi ko‘rishlar paydo bo‘ladi.'}</p><Button variant="outline" disabled={!!busy} onClick={()=>void clear(true)}>{ru?'Отменить скрытие истории':'Tarixni yashirishni bekor qilish'}</Button></div>}
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 space-y-3"><p>{savedJobsError(error.error,ru)}</p><Button variant="outline" disabled={!!busy} onClick={()=>error.more&&!(error.error instanceof AccountApiError&&error.error.status===409)?void more():refresh()}>{error.error instanceof AccountApiError&&error.error.status===409?(ru?'Обновить список':'Ro‘yxatni yangilash'):(ru?'Повторить загрузку':'Qayta yuklash')}</Button></div>}
  {!page&&!error?<p role="status" className="flex gap-3 justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-sky-600"/>{ru?'Загружаем вакансии…':'Vakansiyalar yuklanmoqda…'}</p>:page&&!page.items.length?<div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4 text-center"><h2 className="text-xl font-semibold">{history?(ru?'История пока пуста':'Tarix hozircha bo‘sh'):(ru?'Пока нет избранных вакансий':'Hozircha sevimli vakansiyalar yo‘q')}</h2><Button asChild><Link href="/jobs">{ru?'Найти вакансии':'Vakansiyalarni topish'}</Link></Button></div>:<div className="space-y-4">{page?.items.map(item=>{
   const job=item.job,title=job?(ru?job.title_ru||job.title_uz:job.title_uz||job.title_ru):ru?'Вакансия больше недоступна':'Vakansiya endi mavjud emas';
   const place=job?[job.regions,job.districts].map(value=>value&&(ru?value.name_ru||value.name_uz:value.name_uz||value.name_ru)).filter(Boolean).join(', '):null;
   const employment:Record<string,[string,string]>={full_time:['Полная занятость','To‘liq bandlik'],part_time:['Частичная занятость','Qisman bandlik'],contract:['По договору','Shartnoma'],internship:['Стажировка','Stajirovka'],remote:['Удалённая работа','Masofaviy ish']};
   return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold break-words">{job?<Link href={`/jobs/${job.id}`} className="hover:text-sky-700">{title}</Link>:title}</h2>{!history&&<Button variant="outline" disabled={!!busy} onClick={()=>void remove(item)} aria-label={`${ru?'Убрать из избранного':'Sevimlilardan olib tashlash'}: ${title}`}>{busy===item.id?(ru?'Сохраняем…':'Saqlanmoqda…'):(ru?'Убрать':'Olib tashlash')}</Button>}</div>
    {job?<><p className="text-slate-500">{job.company_name}</p>{place&&<p className="text-sm text-slate-600">{place}</p>}<p className="font-semibold text-sky-800">{formatSalary(job.salary_min,job.salary_max,lang)}</p>{employment[job.employment_type]&&<p className="text-sm text-slate-500">{employment[job.employment_type][ru?0:1]}</p>}</>:<p className="text-sm text-slate-500">{ru?'Публикация скрыта, закрыта или удалена.':'E’lon yashirilgan, yopilgan yoki o‘chirilgan.'}</p>}
    {history&&item.at&&Number.isFinite(Date.parse(item.at))&&<p className="text-xs text-slate-500">{ru?'Просмотрено':'Ko‘rilgan'}: {new Date(item.at).toLocaleString(ru?'ru-RU':'uz-UZ')}</p>}
   </article>;
  })}</div>}
  {page?.nextCursor&&<Button variant="outline" disabled={!!busy} onClick={()=>void more()}>{busy==='more'?(ru?'Загружаем…':'Yuklanmoqda…'):(ru?'Показать ещё':'Yana ko‘rsatish')}</Button>}
  {history&&page?.supportsClear===false&&<p className="text-sm text-slate-500">{ru?'Скрытие истории временно недоступно.':'Tarixni yashirish vaqtincha mavjud emas.'}</p>}
  <AlertDialog open={confirm} onOpenChange={value=>{if(!lock.current)setConfirm(value);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{ru?'Скрыть историю просмотров?':'Ko‘rish tarixi yashirilsinmi?'}</AlertDialogTitle><AlertDialogDescription>{ru?'Прежние просмотры исчезнут из списка. Скрытие можно отменить. Новые просмотры будут сохраняться.':'Oldingi ko‘rishlar ro‘yxatdan yashiriladi. Buni bekor qilish mumkin. Yangi ko‘rishlar saqlanadi.'}</AlertDialogDescription></AlertDialogHeader>{error&&<p role="alert" className="text-red-700 text-sm">{savedJobsError(error.error,ru)}</p>}<AlertDialogFooter><Button variant="outline" disabled={!!busy} onClick={()=>setConfirm(false)}>{ru?'Отмена':'Bekor qilish'}</Button><Button disabled={!!busy} onClick={()=>void clear()}>{ru?'Скрыть':'Yashirish'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div></ProfileLayout>;
}
