'use client';
import {useCallback,useLayoutEffect,useRef,type ReactNode} from 'react';
import Link from 'next/link';
import {useAuth} from '@/contexts/auth-context';
import {useLanguage} from '@/contexts/language-context';
import {Button} from '@/components/ui/button';
import {Loader2} from '@/components/ui/icons';
import {adminApi,adminErrorText} from '@/lib/admin-api';
import {AccountApiError} from '@/lib/account-api';
export function useAdminApi(){
 const {session}=useAuth(),token=useRef(session?.access_token);useLayoutEffect(()=>{token.current=session?.access_token;},[session?.access_token]);
 return useCallback(<T,>(url:string,init:RequestInit={})=>adminApi<T>(token.current,url,init),[]);
}
export function AdminGate({children,superOnly=false}:{children:ReactNode;superOnly?:boolean}){
 const {user,adminProfile,loading,error,refresh}=useAuth(),{lang}=useLanguage(),ru=lang==='ru';
 if(loading)return <div role="status" className="min-h-[50vh] flex items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-sky-600"/>{ru?'Проверяем доступ…':'Kirish tekshirilmoqda…'}</div>;
 if(!user||!adminProfile)return <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 my-10 space-y-4"><h1 className="text-xl font-semibold">{ru?'Доступ к админке':'Admin panelga kirish'}</h1>{Boolean(error)&&<p role="alert" className="text-red-700">{adminErrorText(error,ru)}</p>}<div className="flex gap-3 flex-wrap"><Button asChild><Link href="/admin/login">{ru?'Войти администратором':'Administrator sifatida kirish'}</Link></Button>{Boolean(error)&&!(error instanceof AccountApiError&&[401,403].includes(error.status))&&<Button variant="outline" onClick={()=>void refresh()}>{ru?'Повторить проверку':'Qayta tekshirish'}</Button>}</div></div>;
 if(superOnly&&adminProfile.role!=='super_admin')return <p role="alert" className="p-8 text-red-700">{ru?'Эта страница доступна главному администратору.':'Bu sahifa bosh administrator uchun mavjud.'}</p>;
 return <div key={`${user.id}:${adminProfile.role}:${adminProfile.district_id}`}>{Boolean(error)&&<div role="alert" className="rounded-xl bg-amber-50 p-4 mb-4 space-y-3"><p>{adminErrorText(error,ru)}</p><Button variant="outline" onClick={()=>void refresh()}>{ru?'Повторить проверку':'Qayta tekshirish'}</Button></div>}{children}</div>;
}
export function AdminLayout({children}:{children:ReactNode}){
 const {lang}=useLanguage(),ru=lang==='ru',profile=useAuth().adminProfile;
 return <div className="bg-slate-50 min-h-screen py-6"><div className="container mx-auto px-4 space-y-6"><nav aria-label={ru?'Разделы админки':'Admin panel bo‘limlari'} className="flex flex-wrap gap-3 text-sm text-sky-800">{[['/admin','Обзор','Ko‘rib chiqish'],['/admin/jobs','Вакансии','Vakansiyalar'],['/admin/applications','Отклики','Arizalar'],['/admin/stats','Статистика','Statistika'],...(profile?.role==='super_admin'?[['/admin/import','Импорт','Import'],['/admin/admins','Администраторы','Administratorlar']]:[])].map(([href,russian,uzbek])=><Link key={href} href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-2 hover:border-sky-300">{ru?russian:uzbek}</Link>)}</nav>{children}</div></div>;
}
