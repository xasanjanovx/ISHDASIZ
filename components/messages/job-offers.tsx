'use client';
import {useEffect,useRef,useState} from 'react';
import {accountApi,accountErrorText} from '@/lib/account-api';
import {useLanguage} from '@/contexts/language-context';
import {Button} from '@/components/ui/button';
import {Loader2} from 'lucide-react';
type Job={id:string;title_uz:string|null;title_ru:string|null};
type Page={jobs:Job[];nextCursor:string|null};
export function JobOffers({onSelect,disabled=false}:{onSelect:(job:Job)=>Promise<void>;disabled?:boolean}){
 const {lang}=useLanguage(),ru=lang==='ru';
 const [revision,setRevision]=useState(0),[snapshot,setSnapshot]=useState<(Page&{revision:number})|null>(null),[failure,setFailure]=useState<{revision:number;error:unknown}|null>(null),[moreLoading,setMoreLoading]=useState(false);
 const alive=useRef(false),moreLock=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  const controller=new AbortController();let cancelled=false;
  accountApi<Page>('/api/account/chat/offers',{signal:controller.signal}).then(page=>{if(!cancelled)setSnapshot({...page,revision});}).catch(error=>{if(!cancelled)setFailure({revision,error});});
  return()=>{cancelled=true;controller.abort();};
 },[revision]);
 const page=snapshot?.revision===revision?snapshot:null,error=failure?.revision===revision?failure.error:null;
 const more=async()=>{
  if(!page?.nextCursor||moreLock.current||disabled)return;
  moreLock.current=true;setMoreLoading(true);setFailure(null);
  try{const next=await accountApi<Page>('/api/account/chat/offers?before='+encodeURIComponent(page.nextCursor));if(alive.current)setSnapshot(previous=>previous?.revision===revision?{...next,revision,jobs:Array.from(new Map([...previous.jobs,...next.jobs].map(job=>[job.id,job])).values())}:previous);}
  catch(error){if(alive.current)setFailure({revision,error});}
  finally{moreLock.current=false;if(alive.current)setMoreLoading(false);}
 };
 return <div className="max-h-[50vh] space-y-3 overflow-auto">
  {Boolean(error)&&<div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm"><p>{accountErrorText(error,lang)}</p><Button type="button" variant="outline" disabled={disabled||moreLoading} onClick={()=>page?more():setRevision(value=>value+1)}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button></div>}
  {!page&&!error&&<div role="status"><Loader2 className="animate-spin"/><span className="sr-only">{ru?'Загружаем вакансии':'Vakansiyalar yuklanmoqda'}</span></div>}
  {page&&<>{!page.jobs.length&&!error&&<p className="text-sm text-muted-foreground">{ru?'Нет доступных опубликованных вакансий.':'Mavjud e’lon qilingan vakansiyalar yo‘q.'}</p>}{page.jobs.map(job=><Button key={job.id} type="button" variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" disabled={disabled||moreLoading} onClick={()=>onSelect(job)}>{(ru?job.title_ru||job.title_uz:job.title_uz||job.title_ru)||(ru?'Вакансия':'Vakansiya')}</Button>)}{page.nextCursor&&!error&&<Button type="button" variant="outline" disabled={disabled||moreLoading} onClick={more}>{ru?'Ещё вакансии':'Yana vakansiyalar'}</Button>}</>}
 </div>;
}
