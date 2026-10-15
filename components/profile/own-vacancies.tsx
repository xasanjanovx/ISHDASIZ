'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useLanguage} from '@/contexts/language-context';
import {AccountGate} from './account-gate';
import {VacancyLayout} from './vacancy-layout';
import {adminErrorText} from '@/lib/admin-api';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Loader2,Plus,Briefcase} from '@/components/ui/icons';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter} from '@/components/ui/alert-dialog';
import {accountApi,AccountApiError} from '@/lib/account-api';
import {vacancyState,vacancyErrorText,type Vacancy} from '@/lib/vacancy-api';
import {formatSalary} from '@/lib/constants';
type Page={vacancies:Vacancy[];nextCursor:string|null;stats:Record<string,number>|null;counts_error?:boolean;stats_error?:boolean};
const labels:Record<string,[string,string]>={all:['Все','Barchasi'],active:['Опубликованы','E’lon qilingan'],draft:['Черновики и скрытые','Qoralamalar va yashirilgan'],filled:['Сотрудник найден','Xodim topildi'],archived:['Архив','Arxiv']};
export function OwnVacanciesPage(){return <AccountGate role="employer"><VacancyList/></AccountGate>;}
export function VacancyList({api=accountApi,basePath='/api/account/vacancies',listPath='/profile/employer/vacancies',admin=false}:{api?:typeof accountApi;basePath?:string;listPath?:string;admin?:boolean}) {
 const {lang}=useLanguage(),ru=lang==='ru';
 const [filter,setFilter]=useState('all'),[revision,setRevision]=useState(0);
 const key=`${filter}:${revision}`;
 const [snapshot,setSnapshot]=useState<(Page&{key:string})|null>(null),[failure,setFailure]=useState<{key:string;error:unknown;operation:string}|null>(null);
 const [busy,setBusy]=useState<string|null>(null),[loadingMore,setLoadingMore]=useState(false),[confirm,setConfirm]=useState<{row:Vacancy;action:string}|null>(null);
 const current=useRef(key),alive=useRef(true),actionLock=useRef(false),moreLock=useRef(false);
 useLayoutEffect(()=>{current.current=key;},[key]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  api<Page>(`${basePath}?state=${filter}`,{signal:controller.signal}).then(page=>{if(!cancelled)setSnapshot({...page,key});})
   .catch(error=>{if(!cancelled)setFailure({key,error,operation:'load'});});
  return()=>{cancelled=true;controller.abort();};
 },[filter,revision,key,api,basePath]);
 const page=snapshot?.key===key?snapshot:null,error=failure?.key===key?failure:null;
 const refresh=()=>{setFailure(null);setConfirm(null);setRevision(value=>value+1);};
 const more=async()=>{
  if(!page?.nextCursor||moreLock.current||actionLock.current)return;
  moreLock.current=true;setLoadingMore(true);setFailure(null);
  try {
   const result=await api<Page>(`${basePath}?state=${filter}&before=${page.nextCursor}`);
   if(!alive.current||current.current!==key)return;
   setSnapshot(previous=>{
    if(previous?.key!==key)return previous;
    const rows=new Map(previous.vacancies.map(row=>[row.id,row]));result.vacancies.forEach(row=>{if(!rows.has(row.id))rows.set(row.id,row);});
    return {...result,key,vacancies:Array.from(rows.values())};
   });
  } catch(error){if(alive.current&&current.current===key)setFailure({key,error,operation:'more'});}
  finally{moreLock.current=false;if(alive.current&&current.current===key)setLoadingMore(false);}
 };
 const change=async(row:Vacancy,action:string)=>{
  if(actionLock.current||moreLock.current)return;
  actionLock.current=true;setBusy(row.id);setFailure(null);
  try {
   const result=await api<{vacancy:Vacancy}>(`${basePath}/${row.id}`,{method:'PATCH',body:JSON.stringify({action,expected_updated_at:row.updated_at??null})});
   if(!alive.current||current.current!==key)return;
   if(result.vacancy?.id!==row.id)throw new AccountApiError(503);
   setSnapshot(previous=>{
    if(previous?.key!==key)return previous;
    const saved={...row,...result.vacancy},oldState=vacancyState(row),newState=vacancyState(saved),stats=previous.stats?{...previous.stats}:null;
    if(stats&&oldState!==newState){stats[oldState]=Math.max(0,stats[oldState]-1);stats[newState]++;}
    return {...previous,stats,vacancies:previous.vacancies.map(item=>item.id===row.id?saved:item).filter(item=>filter==='all'||vacancyState(item)===filter)};
   });setConfirm(null);
  } catch(error){if(alive.current&&current.current===key)setFailure({key,error,operation:'action'});}
  finally{actionLock.current=false;if(alive.current&&current.current===key)setBusy(null);}
 };
 const disabled=Boolean(busy)||loadingMore;
 return <VacancyLayout admin={admin}><div className="space-y-6">
  <div className="flex flex-wrap justify-between items-start gap-4"><div><h1 className="text-2xl font-semibold text-foreground">{admin?(ru?'Вакансии':'Vakansiyalar'):(ru?'Мои вакансии':'Mening vakansiyalarim')}</h1><p className="mt-2 text-muted-foreground">{admin?(ru?'Управление публикациями и архивом':'E’lonlar va arxivni boshqarish'):(ru?'Размещайте вакансии и находите людей для своей команды':'Vakansiyalar joylang va jamoangiz uchun xodimlar toping')}</p></div><Button asChild><Link href={`${listPath}/new`}><Plus className="mr-2 h-4 w-4"/>{ru?'Создать вакансию':'Vakansiya yaratish'}</Link></Button></div>
  <div className="flex flex-wrap gap-2" aria-label={ru?'Статус вакансий':'Vakansiya holati'}>{Object.entries(labels).map(([state,label])=><Button key={state} variant={filter===state?'default':'outline'} disabled={disabled} aria-pressed={filter===state} onClick={()=>{setFailure(null);setConfirm(null);setFilter(state);}}>{label[ru?0:1]}{page?.stats&&<span className="ml-2 tabular-nums">{page.stats[state]}</span>}</Button>)}</div>
  {error&&<div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3 text-red-700"><p>{admin?adminErrorText(error.error,ru):vacancyErrorText(error.error,lang)}</p><Button variant="outline" disabled={disabled} onClick={()=>error.operation==='more'?void more():refresh()}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button></div>}
  {(page?.counts_error||page?.stats_error)&&<div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3"><p>{ru?'Не удалось загрузить счётчики. Вакансии доступны для редактирования.':'Hisoblagichlarni yuklab bo‘lmadi. Vakansiyalarni tahrirlash mumkin.'}</p><Button variant="outline" disabled={disabled} onClick={refresh}>{ru?'Повторить счётчики':'Hisoblagichlarni qayta yuklash'}</Button></div>}
  {!page&&!error?<div role="status" className="flex gap-3 justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary"/>{ru?'Загружаем вакансии…':'Vakansiyalar yuklanmoqda…'}</div>
   :page&&!page.vacancies.length?<div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3"><Briefcase className="h-10 w-10 text-primary mx-auto"/><h2 className="text-xl font-semibold">{ru?'В этом разделе пока нет вакансий':'Ushbu bo‘limda hozircha vakansiyalar yo‘q'}</h2><p className="text-muted-foreground">{ru?'Выберите другой статус или создайте новую вакансию.':'Boshqa holatni tanlang yoki yangi vakansiya yarating.'}</p></div>
   :<div className="space-y-4">{page?.vacancies.map(row=>{
    const state=vacancyState(row),title=(ru?row.title_ru||row.title_uz:row.title_uz||row.title_ru)||'—';
    const location=[row.regions,row.districts].map(value=>{const place=Array.isArray(value)?value[0]:value;return place&&(ru?place.name_ru||place.name_uz:place.name_uz||place.name_ru);}).filter(Boolean).join(', ');
    return <article key={row.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
     <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-semibold text-foreground break-words">{title}</h2><p className="text-sm text-muted-foreground mt-1">{row.company_name}</p></div><Badge className={state==='active'?'bg-accent text-primary':'bg-secondary text-foreground'}>{labels[state][ru?0:1]}</Badge></div>
     {admin&&['filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed'].includes(row.source_status)&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{ru?'Источник закрыл или снял вакансию. На сайте она недоступна.':'Manba vakansiyani yopgan yoki olib tashlagan. Saytda u mavjud emas.'}</p>}{location&&<p className="text-sm text-muted-foreground">{location}</p>}<p className="font-semibold text-primary">{formatSalary(row.salary_min,row.salary_max,lang)}</p>
     <div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span>{ru?'Просмотры':'Ko‘rishlar'}: {row.views_count??'—'}</span><span>{ru?'Отклики':'Arizalar'}: {row.applications_count??'—'}</span></div>
     <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {state!=='archived'&&<Button variant="outline" asChild><Link href={`${listPath}/${row.id}`}>{ru?'Редактировать':'Tahrirlash'}</Link></Button>}
      {state==='active'&&<>{!['filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed'].includes(row.source_status)&&<Button variant="outline" asChild><Link href={`/jobs/${row.id}`}>{ru?'Посмотреть на сайте':'Saytda ko‘rish'}</Link></Button>}<Button variant="outline" disabled={disabled} onClick={()=>void change(row,'hide')}>{ru?'Скрыть':'Yashirish'}</Button></>}
      {(state==='draft'||state==='filled')&&<Button disabled={disabled} onClick={()=>state==='filled'?setConfirm({row,action:'publish'}):void change(row,'publish')}>{state==='filled'?(ru?'Открыть заново':'Qayta ochish'):(ru?'Опубликовать':'E’lon qilish')}</Button>}
      {state!=='filled'&&state!=='archived'&&<Button variant="outline" disabled={disabled} onClick={()=>setConfirm({row,action:'filled'})}>{ru?'Сотрудник найден':'Xodim topildi'}</Button>}
      {state==='archived'?<Button variant="outline" disabled={disabled} onClick={()=>void change(row,'restore')}>{ru?'Восстановить как черновик':'Qoralama sifatida tiklash'}</Button>:<Button variant="outline" disabled={disabled} onClick={()=>setConfirm({row,action:'archive'})}>{ru?'В архив':'Arxivga'}</Button>}
      {busy===row.id&&<span role="status" className="self-center text-sm text-primary">{ru?'Сохраняем…':'Saqlanmoqda…'}</span>}
     </div>
    </article>;
   })}</div>}
  {page?.nextCursor&&<Button variant="outline" disabled={disabled} onClick={()=>void more()}>{loadingMore?(ru?'Загружаем…':'Yuklanmoqda…'):(ru?'Показать ещё':'Yana ko‘rsatish')}</Button>}
  <AlertDialog open={Boolean(confirm)} onOpenChange={open=>{if(!open&&!actionLock.current)setConfirm(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.action==='archive'?(ru?'Убрать вакансию в архив?':'Vakansiya arxivga olinsinmi?'):confirm?.action==='filled'?(ru?'Сотрудник найден?':'Xodim topildimi?'):(ru?'Открыть вакансию заново?':'Vakansiya qayta ochilsinmi?')}</AlertDialogTitle><AlertDialogDescription>{confirm?.action==='archive'?(ru?'Вакансия будет скрыта. Отклики сохранятся, вакансию можно восстановить как черновик.':'Vakansiya yashiriladi. Arizalar saqlanadi, vakansiyani qoralama sifatida tiklash mumkin.'):confirm?.action==='filled'?(ru?'Вакансия будет помечена как закрытая и скрыта от соискателей.':'Vakansiya yopilgan deb belgilanadi va nomzodlardan yashiriladi.'):(ru?'Вакансия снова станет доступна соискателям.':'Vakansiya nomzodlar uchun yana ochiq bo‘ladi.')}</AlertDialogDescription></AlertDialogHeader>
   {error?.operation==='action'&&<p role="alert" className="text-sm text-red-700">{admin?adminErrorText(error.error,ru):vacancyErrorText(error.error,lang)}</p>}
   <AlertDialogFooter><Button variant="outline" disabled={disabled} onClick={()=>setConfirm(null)}>{ru?'Отмена':'Bekor qilish'}</Button><Button disabled={disabled} onClick={()=>{if(confirm)void change(confirm.row,confirm.action);}}>{ru?'Подтвердить':'Tasdiqlash'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div></VacancyLayout>;
}
