'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useLanguage} from '@/contexts/language-context';
import {accountApi} from '@/lib/account-api';
import {publicStats,type PublicStats,type StatsGroup,type DistrictStatsGroup} from '@/lib/public-stats';
import {Briefcase,Eye,MapPin,Users} from '@/components/ui/icons';
import {Button} from '@/components/ui/button';

export function PublicStatistics({compact=false}:{compact?:boolean}){
 const {lang,t}=useLanguage(),ru=lang==='ru';
 const [revision,setRevision]=useState(0),[snapshot,setSnapshot]=useState<{revision:number;stats:PublicStats|null;error:unknown}|null>(null);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  accountApi<{stats:PublicStats}>('/api/stats',{signal:controller.signal}).then(result=>{
   const stats=publicStats(result.stats);if(!cancelled)setSnapshot({revision,stats,error:null});
  }).catch(error=>{if(!cancelled)setSnapshot({revision,stats:null,error});});
  return()=>{cancelled=true;controller.abort();};
 },[revision]);
 const current=snapshot?.revision===revision?snapshot:null,loading=!current,stats=current?.stats??null,error=current?.error??null;
 const number=(value:number)=>value.toLocaleString(ru?'ru-RU':'uz-UZ');
 const cards=stats?[
  {label:ru?'Доступных вакансий':'Mavjud vakansiyalar',value:stats.availableJobs,icon:Briefcase},
  {label:ru?'Регионов с вакансиями':'Vakansiyali hududlar',value:stats.regionCount,icon:MapPin},
  {label:ru?'Откликов на доступные вакансии':'Mavjud vakansiyalarga arizalar',value:stats.applications,icon:Users},
  {label:ru?'Просмотров доступных вакансий':'Mavjud vakansiyalar ko‘rilgan',value:stats.views,icon:Eye}
 ]:[];
 function groupName(group:StatsGroup,kind:'region'|'category'|'district'){
  const known=ru?group.name_ru||group.name_uz:group.name_uz||group.name_ru;
  if(known)return known;
  const missing={region:ru?'Регион не указан':'Hudud ko‘rsatilmagan',category:ru?'Категория не указана':'Toifa ko‘rsatilmagan',district:ru?'Район не указан':'Tuman ko‘rsatilmagan'};
  return group.id===null?missing[kind]:`${ru?'Без названия':'Nomi mavjud emas'} · ${group.id}`;
 }
 function rows(groups:StatsGroup[],kind:'region'|'category'|'district'){
  if(!groups.length)return <p className="text-muted-foreground">{ru?'Доступных вакансий пока нет.':'Hozircha mavjud vakansiyalar yo‘q.'}</p>;
  return <ul className="space-y-5">{groups.map(group=>{
   const district=group as DistrictStatsGroup,region=kind==='district'?(ru?district.region_ru||district.region_uz:district.region_uz||district.region_ru):null;
   const name=groupName(group,kind),href=group.id===null?null:`/jobs?${kind}=${encodeURIComponent(group.id)}`;
   return <li key={String(group.id)}><div className="flex items-start justify-between gap-4"><div className="min-w-0">{href?<Link href={href} className="text-sm font-medium text-foreground hover:text-primary hover:underline">{name}</Link>:<span className="text-sm font-medium text-foreground">{name}</span>}{region&&<p className="mt-1 text-xs text-muted-foreground">{region}</p>}</div><span className="shrink-0 text-sm font-semibold text-primary">{number(group.count)}</span></div><div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:`${stats&&stats.availableJobs?group.count/stats.availableJobs*100:0}%`}}/></div></li>;
  })}</ul>;
 }
 return <section className={`mx-auto max-w-6xl px-4 ${compact?'py-10':'py-8 sm:py-12'} space-y-7`}>
  <div className="flex flex-wrap items-start justify-between gap-4"><div>{compact?<h2 className="text-2xl font-bold text-foreground">{ru?'Статистика платформы':'Platforma statistikasi'}</h2>:<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{ru?'Статистика вакансий':'Vakansiyalar statistikasi'}</h1>}<p className="mt-3 max-w-2xl text-muted-foreground">{ru?'Доступные вакансии ISHDASIZ по всему Узбекистану. Показатели относятся к публикациям на платформе.':'O‘zbekiston bo‘ylab ISHDASIZ da mavjud vakansiyalar. Ko‘rsatkichlar platformadagi e’lonlarga tegishli.'}</p></div><Button asChild variant="outline"><Link href="/jobs">{ru?'Открыть вакансии':'Vakansiyalarni ochish'}</Link></Button></div>
  {loading?<p role="status" className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">{ru?'Загружаем показатели…':'Ko‘rsatkichlar yuklanmoqda…'}</p>:error?<div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4"><p className="text-amber-900">{ru?'Не удалось загрузить статистику. Попробуйте ещё раз.':'Statistikani yuklab bo‘lmadi. Qayta urinib ko‘ring.'}</p><Button variant="outline" onClick={()=>setRevision(value=>value+1)}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button></div>:stats&&<>
   <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card=><div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><card.icon aria-hidden="true" className="mb-5 h-6 w-6 text-primary"/><dt className="text-sm text-muted-foreground">{card.label}</dt><dd className="mt-2 text-3xl font-bold tabular-nums text-foreground">{number(card.value)}</dd></div>)}</dl>
   <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{ru?'Обновлено: ':'Yangilangan: '}<time dateTime={stats.asOf}>{new Date(stats.asOf).toLocaleString(ru?'ru-RU':'uz-UZ')}</time></p><Button variant="ghost" onClick={()=>setRevision(value=>value+1)}>{ru?'Обновить показатели':'Ko‘rsatkichlarni yangilash'}</Button></div>
   {!compact&&<div className="grid items-start gap-5 md:grid-cols-2">
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="mb-6 text-lg font-semibold text-foreground">{ru?'По регионам':'Hududlar bo‘yicha'}</h2>{rows(stats.byRegion,'region')}</section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="mb-6 text-lg font-semibold text-foreground">{ru?'По категориям':'Toifalar bo‘yicha'}</h2>{rows(stats.byCategory,'category')}</section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="mb-6 text-lg font-semibold text-foreground">{ru?'По типу занятости':'Bandlik turi bo‘yicha'}</h2>{stats.byEmployment.length?<ul className="space-y-4">{stats.byEmployment.map(group=><li key={String(group.type)} className="flex items-start justify-between gap-4 text-sm"><span className="text-foreground">{group.type?t.employmentTypes[group.type as keyof typeof t.employmentTypes]:ru?'Тип не указан':'Turi ko‘rsatilmagan'}</span><span className="font-semibold text-primary">{number(group.count)}</span></li>)}</ul>:<p className="text-muted-foreground">{ru?'Доступных вакансий пока нет.':'Hozircha mavjud vakansiyalar yo‘q.'}</p>}</section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold text-foreground">{ru?'По районам':'Tumanlar bo‘yicha'}</h2><details><summary className="cursor-pointer rounded-lg py-2 font-medium text-primary">{ru?'Показать распределение по районам':'Tumanlar bo‘yicha taqsimotni ko‘rsatish'}</summary><div className="mt-4">{rows(stats.byDistrict,'district')}</div></details></section>
   </div>}
  </>}
 </section>;
}
