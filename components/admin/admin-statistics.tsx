'use client';
import Link from 'next/link';
import {AdminGate,AdminLayout} from './admin-gate';
import {useAdminData} from './admin-data';
import {useAuth} from '@/contexts/auth-context';
import {useLanguage} from '@/contexts/language-context';
import {Button} from '@/components/ui/button';
import {adminErrorText} from '@/lib/admin-api';
import type {AdminStats as Stats,AdminStatsGroup as Group} from '@/lib/admin-stats';
export function AdminStatisticsPage({detailed=false}:{detailed?:boolean}){return <AdminGate><AdminLayout><Statistics detailed={detailed}/></AdminLayout></AdminGate>;}
function Statistics({detailed}:{detailed:boolean}){
 const {lang}=useLanguage(),ru=lang==='ru',profile=useAuth().adminProfile;
 const {data,error,loading,reload}=useAdminData<{stats:Stats}>('/api/admin/stats'),stats=data?.stats;
 const typeLabels:Record<string,[string,string]>={full_time:['Полная занятость','To‘liq bandlik'],part_time:['Частичная занятость','Qisman bandlik'],contract:['По договору','Shartnoma'],internship:['Стажировка','Stajirovka'],remote:['Удалённая работа','Masofaviy ish']};
 const title=(row:Group)=>row.type?(typeLabels[row.type]?.[ru?0:1]||row.type):(ru?row.name_ru||row.name_uz:row.name_uz||row.name_ru)||(ru?'Не указан':'Ko‘rsatilmagan');
 return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{detailed?(ru?'Статистика':'Statistika'):(ru?'Обзор работы сайта':'Sayt faoliyati')} </h1><p className="text-muted-foreground mt-2">{profile?.role==='super_admin'?(ru?'Весь Узбекистан':'Butun O‘zbekiston'):(ru?'Назначенный вам район':'Sizga belgilangan tuman')}</p></div><Button variant="outline" disabled={loading} onClick={reload}>{ru?'Обновить':'Yangilash'}</Button></div>
  {loading&&<p role="status">{ru?'Загружаем статистику…':'Statistika yuklanmoqda…'}</p>}
  {Boolean(error)&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 space-y-3"><p>{adminErrorText(error,ru)}</p><Button variant="outline" onClick={reload}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button></div>}
  {stats&&<><div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{([
   ['Всего вакансий','Jami vakansiyalar',stats.totalJobs],['Доступны на сайте','Saytda ochiq',stats.activeJobs],['Скрыты','Yashirilgan',stats.hiddenJobs],['Сняты источником','Manbada olib tashlangan',stats.removedJobs],['Отклики','Arizalar',stats.totalApplications],['Просмотры вакансий','Vakansiya ko‘rishlari',stats.totalViews],
  ] as Array<[string,string,number]>).map(([russian,uzbek,value])=><div key={russian} className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{ru?russian:uzbek}</p><p className="text-3xl font-semibold text-primary mt-3 tabular-nums">{value.toLocaleString(ru?'ru-RU':'uz-UZ')}</p></div>)}</div>
   {detailed&&<div className="grid md:grid-cols-2 gap-5">{([['По отраслям','Sohalar bo‘yicha',stats.jobsByCategory],['По районам','Tumanlar bo‘yicha',stats.jobsByDistrict],['По занятости','Bandlik bo‘yicha',stats.jobsByType]] as Array<[string,string,Group[]]>).map(([russian,uzbek,rows])=><section key={russian} className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold mb-4">{ru?russian:uzbek}</h2>{!rows.length?<p className="text-muted-foreground">{ru?'Пока нет вакансий':'Hozircha vakansiyalar yo‘q'}</p>:<ul className="space-y-3">{rows.map((row,index)=><li key={String(row.id||row.type||index)} className="flex justify-between gap-3 border-b border-border pb-2"><span className="min-w-0 break-words">{title(row)}</span><span className="font-semibold tabular-nums">{row.count.toLocaleString(ru?'ru-RU':'uz-UZ')}</span></li>)}</ul>}</section>)}</div>}
  </>}
  {!detailed&&<div className="flex flex-wrap gap-3"><Button asChild><Link href="/admin/jobs/new">{ru?'Создать вакансию':'Vakansiya yaratish'}</Link></Button><Button asChild variant="outline"><Link href="/admin/jobs">{ru?'Управлять вакансиями':'Vakansiyalarni boshqarish'}</Link></Button><Button asChild variant="outline"><Link href="/admin/applications">{ru?'Открыть отклики':'Arizalarni ochish'}</Link></Button></div>}
 </div>;
}
