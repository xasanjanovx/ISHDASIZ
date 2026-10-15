'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useLanguage} from '@/contexts/language-context';
import {AccountGate} from './account-gate';
import {ProfileLayout} from './profile-layout';
import {accountApi,accountErrorText} from '@/lib/account-api';
import {Button} from '@/components/ui/button';
import {PageLoading} from '@/components/layout/page-loading';
import {BadgeCheck,Building2,ExternalLink,Key,Shield} from 'lucide-react';
type Status={verified:boolean;providers:{oneid:boolean;eri:boolean}};
const callbacks:Record<string,[string,string]>={
 oneid_denied:['Авторизация через OneID отменена','OneID orqali avtorizatsiya bekor qilindi'],eri_denied:['Авторизация через ЭЦП отменена','ERI orqali avtorizatsiya bekor qilindi'],
 not_configured:['Сервис подтверждения пока не подключён','Tasdiqlash xizmati hali ulanmagan'],session_expired:['Сессия истекла. Войдите снова','Sessiya tugadi. Qayta kiring'],
 invalid_state:['Сессия подтверждения недействительна. Начните заново','Tasdiqlash sessiyasi yaroqsiz. Qayta boshlang'],verify_failed:['Компания не подтверждена сервисом','Kompaniya xizmat orqali tasdiqlanmadi'],
 save_failed:['Не удалось сохранить подтверждение. Повторите попытку','Tasdiqlashni saqlab bo‘lmadi. Qayta urinib ko‘ring'],
};
export function CompanyVerificationPage(){return <AccountGate role="employer"><CompanyVerification/></AccountGate>;}
export function CompanyVerification(){
 const {lang}=useLanguage(),ru=lang==='ru',params=useSearchParams();
 const [revision,setRevision]=useState(0),[snapshot,setSnapshot]=useState<{revision:number;status:Status|null;error:unknown}|null>(null);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  accountApi<Status>('/api/account/verification',{signal:controller.signal}).then(status=>{
   if(typeof status.verified!=='boolean')throw new Error('Verification unavailable');
   if(!cancelled)setSnapshot({revision,status:{verified:status.verified,providers:{oneid:status.providers?.oneid===true,eri:status.providers?.eri===true}},error:null});
  }).catch(error=>{if(!cancelled)setSnapshot({revision,status:null,error});});
  return()=>{cancelled=true;controller.abort();};
 },[revision]);
 const current=snapshot?.revision===revision?snapshot:null,status=current?.status;
 const callbackError=params.get('error'),callback=callbackError?(callbacks[callbackError]||['Подтверждение не завершено. Попробуйте ещё раз','Tasdiqlash yakunlanmadi. Qayta urinib ko‘ring']):null;
 return <ProfileLayout userType="employer"><div className="mx-auto max-w-3xl space-y-6">
  <div className="flex items-start gap-4"><div className="rounded-2xl bg-accent p-3 text-primary"><Shield className="size-7"/></div><div><h1 className="text-2xl font-semibold text-foreground">{ru?'Подтверждение компании':'Kompaniyani tasdiqlash'}</h1><p className="mt-2 text-muted-foreground">{ru?'Статус компании проверяется по данным вашего профиля.':'Kompaniya holati profilingiz ma’lumotlari asosida tekshiriladi.'}</p></div></div>
  {callback&&<p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{callback[ru?0:1]}</p>}
  {!current?<PageLoading/>:current.error?<div role="alert" className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6"><p>{accountErrorText(current.error,lang)}</p><Button variant="outline" onClick={()=>setRevision(value=>value+1)}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button></div>:status&&<>
   <section className={`rounded-2xl border p-6 ${status.verified?'border-border bg-accent':'border-border bg-card'}`}>
    {status.verified?<BadgeCheck aria-hidden="true" className="mb-4 size-10 text-primary"/>:<Building2 aria-hidden="true" className="mb-4 size-10 text-primary"/>}
    <h2 className="text-xl font-semibold text-foreground">{status.verified?(ru?'Компания подтверждена':'Kompaniya tasdiqlangan'):(ru?'Компания пока не подтверждена':'Kompaniya hali tasdiqlanmagan')}</h2>
    <p className="mt-3 text-muted-foreground">{status.verified?(ru?'Подтверждение сохранено в профиле компании.':'Tasdiqlash kompaniya profilida saqlangan.'):(ru?'Выберите доступный сервис для проверки данных компании. После проверки статус обновится.':'Kompaniya ma’lumotlarini tekshirish uchun mavjud xizmatni tanlang. Tekshiruvdan so‘ng holat yangilanadi.')}</p>
   </section>
   {!status.verified&&<section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold text-foreground">{ru?'Способ подтверждения':'Tasdiqlash usuli'}</h2><div className="mt-5 space-y-4">{(['oneid','eri'] as const).map(provider=>{
    const enabled=status.providers[provider],title=provider==='oneid'?'OneID':ru?'Электронная подпись (ЭЦП)':'Elektron raqamli imzo (ERI)',Icon=provider==='oneid'?Building2:Key;
    return <div key={provider} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"><div className="flex items-center gap-3"><Icon aria-hidden="true" className="size-6 text-primary"/><div><h3 className="font-medium text-foreground">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{enabled?(ru?'Сервис подключён':'Xizmat ulangan'):(ru?'Сервис пока не подключён':'Xizmat hali ulanmagan')}</p></div></div>{enabled?<Button asChild variant="outline"><a href={'/api/auth/'+provider}>{ru?'Начать проверку':'Tekshiruvni boshlash'}<ExternalLink aria-hidden="true" className="ml-2 size-4"/></a></Button>:<Button variant="outline" disabled>{ru?'Пока недоступно':'Hozircha mavjud emas'}</Button>}</div>;
   })}</div></section>}
  </>}
 </div></ProfileLayout>;
}
