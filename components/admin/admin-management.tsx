'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useAuth} from '@/contexts/auth-context';
import {useLanguage} from '@/contexts/language-context';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {LocationSelect} from '@/components/ui/location-select';
import {AccountApiError} from '@/lib/account-api';
import {adminErrorText} from '@/lib/admin-api';
import type {AdminManagementPage,ManagedAdmin} from '@/lib/admin-management';
import {AdminGate,AdminLayout,useAdminApi} from './admin-gate';
import {useAdminData} from './admin-data';

type Form={full_name:string;email:string;password:string;role:string;region:string;district:string};
type Editor={kind:'create';requestId:string;target:null}|{kind:'edit';target:ManagedAdmin;requestId:null};
const emptyForm=():Form=>({full_name:'',email:'',password:'',role:'hokimlik_assistant',region:'',district:''});
export function AdminManagement(){return <AdminGate superOnly><AdminLayout><Management/></AdminLayout></AdminGate>;}
function Management(){
 const {lang}=useLanguage(),ru=lang==='ru',{user,refresh}=useAuth(),api=useAdminApi();
 const [filter,setFilter]=useState({page:0,state:'all',search:''}),[query,setQuery]=useState('');
 const params=new URLSearchParams({page:String(filter.page),state:filter.state,search:filter.search});
 const {data,error,loading,reload}=useAdminData<AdminManagementPage>('/api/admin/admins?'+params);
 const [editor,setEditor]=useState<Editor|null>(null),[form,setForm]=useState<Form>(emptyForm),[confirmation,setConfirmation]=useState<{target:ManagedAdmin;action:'disable'|'enable'}|null>(null);
 const [actionError,setActionError]=useState<unknown>(null),[busy,setBusy]=useState(false),[frozen,setFrozen]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true),flight=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const text=(r:string,u:string)=>ru?r:u;
 function openCreate(){setEditor({kind:'create',target:null,requestId:crypto.randomUUID()});setForm(emptyForm());setActionError(null);setFrozen(false);}
 function openEdit(target:ManagedAdmin){setEditor({kind:'edit',target,requestId:null});setForm({full_name:target.full_name||'',email:target.email||'',password:'',role:target.role,region:String(target.districts?.region_id||''),district:String(target.district_id||'')});setActionError(null);setFrozen(false);}
 async function save(event:FormEvent){
  event.preventDefault();if(!editor||flight.current)return;
  flight.current=true;setBusy(true);setActionError(null);
  const payload={full_name:form.full_name,role:form.role,district_id:form.role==='super_admin'?null:Number(form.district)};
  try{
   const result=await api<{profile:ManagedAdmin}>(editor.kind==='create'?'/api/admin/admins':'/api/admin/admins/'+editor.target.id,{method:editor.kind==='create'?'POST':'PATCH',body:JSON.stringify(editor.kind==='create'?{...payload,email:form.email,password:form.password,request_id:editor.requestId}:{...payload,action:'edit',expected_updated_at:editor.target.updated_at})});
   if(!alive.current)return;
   if(!result.profile?.id||(editor.kind==='edit'&&result.profile.id!==editor.target.id))throw new Error('Unconfirmed save');
   setEditor(null);setForm(emptyForm());setNotice(text('Администратор сохранён.','Administrator saqlandi.'));reload();
   if(result.profile.id===user?.id)void refresh();
  }catch(reason){if(alive.current){setActionError(reason);if(editor.kind==='create'&&(!(reason instanceof AccountApiError)||![400,401,403].includes(reason.status)))setFrozen(true);}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function changeAccess(){
  if(!confirmation||flight.current)return;flight.current=true;setBusy(true);setActionError(null);
  try{
   const result=await api<{profile:ManagedAdmin}>('/api/admin/admins/'+confirmation.target.id,{method:'PATCH',body:JSON.stringify({action:confirmation.action,expected_updated_at:confirmation.target.updated_at})});
   if(!alive.current)return;
   if(result.profile?.id!==confirmation.target.id||Boolean(result.profile.disabled_at)!==(confirmation.action==='disable'))throw new Error('Unconfirmed access change');
   setConfirmation(null);setNotice(text('Доступ обновлён.','Kirish yangilandi.'));reload();
  }catch(reason){if(alive.current)setActionError(reason);}finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const editSelf=editor?.kind==='edit'&&editor.target.id===user?.id;
 return <>
  <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-foreground">{text('Администраторы','Administratorlar')}</h1><p className="mt-2 text-muted-foreground">{text('Управляйте доступом к проекту по всему Узбекистану.','O‘zbekiston bo‘ylab loyihaga kirishni boshqaring.')}</p></div><Button onClick={openCreate}>{text('Добавить администратора','Administrator qo‘shish')}</Button></header>
  {notice&&<p role="status" className="rounded-xl bg-accent p-4 text-primary">{notice}</p>}
  <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4" onSubmit={event=>{event.preventDefault();setFilter({...filter,page:0,search:query.trim()});}}>
   <div className="flex-1 min-w-[180px]"><Label htmlFor="admin-search">{text('Имя или email','Ism yoki email')}</Label><Input id="admin-search" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)}/></div>
   <div><Label htmlFor="admin-state">{text('Доступ','Kirish')}</Label><select id="admin-state" className="block h-10 rounded-lg border bg-card px-3" value={filter.state} onChange={event=>setFilter({...filter,page:0,state:event.target.value})}><option value="all">{text('Все','Barchasi')}</option><option value="active">{text('Включён','Faol')}</option><option value="disabled">{text('Отключён','O‘chirilgan')}</option></select></div><Button type="submit" variant="outline">{text('Найти','Qidirish')}</Button>
  </form>
  {loading&&<p role="status">{text('Загружаем администраторов…','Administratorlar yuklanmoqda…')}</p>}
  {Boolean(error)&&<div role="alert" className="rounded-xl bg-red-50 p-4 space-y-3"><p>{adminErrorText(error,ru)}</p><Button variant="outline" onClick={reload}>{text('Повторить загрузку','Qayta yuklash')}</Button></div>}
  {data&&<><p className="text-sm text-muted-foreground">{text('Найдено','Topildi')}: {data.total}</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.admins.map(target=><article key={target.id} className="rounded-2xl border border-border bg-card p-5 space-y-3 min-w-0"><h2 className="font-semibold break-words">{target.full_name}</h2><p className="text-sm text-muted-foreground break-all">{target.email||text('Email недоступен','Email mavjud emas')}</p><p className="text-sm">{target.role==='super_admin'?text('Главный администратор · вся страна','Bosh administrator · butun mamlakat'):text('Помощник хокимията','Hokimlik yordamchisi')}</p>{target.role==='hokimlik_assistant'&&<p className="text-sm text-muted-foreground">{(ru?target.districts?.name_ru:target.districts?.name_uz)||text('Район не назначен','Tuman belgilanmagan')}</p>}<p className={target.disabled_at?'text-amber-700':'text-primary'}>{target.disabled_at?text('Доступ отключён','Kirish o‘chirilgan'):text('Доступ включён','Kirish yoqilgan')}{target.id===user?.id&&text(' · Ваш аккаунт',' · Sizning hisobingiz')}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>openEdit(target)}>{text('Редактировать','Tahrirlash')}</Button>{target.id!==user?.id&&<Button variant="outline" onClick={()=>{setActionError(null);setConfirmation({target,action:target.disabled_at?'enable':'disable'});}}>{target.disabled_at?text('Восстановить доступ','Kirishni tiklash'):text('Отключить доступ','Kirishni o‘chirish')}</Button>}</div></article>)}</div>{data.admins.length===0&&<p className="rounded-2xl border bg-card p-6">{text('Администраторы по этим условиям не найдены.','Bu shartlarga mos administratorlar topilmadi.')}</p>}<div className="flex flex-wrap items-center gap-4"><Button variant="outline" disabled={filter.page===0} onClick={()=>setFilter({...filter,page:filter.page-1})}>{text('Назад','Orqaga')}</Button><span>{text('Страница','Sahifa')} {filter.page+1}</span><Button variant="outline" disabled={!data.hasMore} onClick={()=>setFilter({...filter,page:filter.page+1})}>{text('Далее','Keyingi')}</Button></div></>}
  <Dialog open={Boolean(editor)} onOpenChange={open=>{if(!open&&!flight.current){setEditor(null);setForm(emptyForm());}}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editor?.kind==='create'?text('Новый администратор','Yangi administrator'):text('Редактировать администратора','Administratorni tahrirlash')}</DialogTitle><DialogDescription>{text('Главный администратор управляет всей страной и доступом других администраторов. Помощник работает с вакансиями и откликами своего района.','Bosh administrator butun mamlakatni va boshqa administratorlar kirishini boshqaradi. Yordamchi o‘z tumanidagi vakansiya va arizalar bilan ishlaydi.')}</DialogDescription></DialogHeader>
   <form onSubmit={save} className="space-y-4"><div><Label htmlFor="admin-name">{text('Имя','Ism')}</Label><Input id="admin-name" required maxLength={120} value={form.full_name} disabled={busy||frozen} onChange={event=>setForm({...form,full_name:event.target.value})}/></div>
    {editor?.kind==='create'&&<><div><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" required maxLength={254} autoComplete="off" value={form.email} disabled={busy||frozen} onChange={event=>setForm({...form,email:event.target.value})}/></div><div><Label htmlFor="admin-password">{text('Пароль','Parol')}</Label><Input id="admin-password" type="password" required minLength={12} autoComplete="new-password" value={form.password} disabled={busy||frozen} onChange={event=>setForm({...form,password:event.target.value})}/><p className="text-xs text-muted-foreground mt-1">{text('От 12 символов, до 72 байт.','Kamida 12 ta belgi, 72 baytgacha.')}</p></div></>}
    <div><Label htmlFor="admin-role">{text('Роль','Rol')}</Label><select id="admin-role" className="block h-10 w-full rounded-lg border bg-card px-3" value={form.role} disabled={busy||frozen||editSelf} onChange={event=>setForm({...form,role:event.target.value,district:'',region:''})}><option value="hokimlik_assistant">{text('Помощник хокимията','Hokimlik yordamchisi')}</option><option value="super_admin">{text('Главный администратор','Bosh administrator')}</option></select></div>
    {form.role==='hokimlik_assistant'&&<LocationSelect required selectedRegion={form.region} selectedDistrict={form.district} disabled={busy||frozen} onRegionChange={region=>setForm({...form,region,district:''})} onDistrictChange={district=>setForm({...form,district})}/>}
    {frozen&&<p className="text-sm text-amber-800">{text('Результат создания ещё не подтверждён. Повторите с сохранёнными данными, чтобы завершить ту же операцию.','Yaratish natijasi hali tasdiqlanmagan. Shu amalni yakunlash uchun saqlangan ma’lumotlar bilan takrorlang.')}</p>}
    {Boolean(actionError)&&<p role="alert" className="text-red-700">{adminErrorText(actionError,ru)}</p>}
    <Button type="submit" disabled={busy||(form.role==='hokimlik_assistant'&&(!form.region||!form.district))}>{busy?text('Сохраняем…','Saqlanmoqda…'):frozen?text('Повторить создание','Yaratishni takrorlash'):text('Сохранить','Saqlash')}</Button>
   </form></DialogContent></Dialog>
  <Dialog open={Boolean(confirmation)} onOpenChange={open=>{if(!open&&!flight.current)setConfirmation(null);}}><DialogContent><DialogHeader><DialogTitle>{confirmation?.action==='disable'?text('Отключить доступ?','Kirish o‘chirilsinmi?'):text('Восстановить доступ?','Kirish tiklansinmi?')}</DialogTitle><DialogDescription>{confirmation?.target.full_name}. {text('Профиль сохранится. Доступ можно восстановить через эту страницу.','Profil saqlanadi. Kirishni shu sahifada tiklash mumkin.')}</DialogDescription></DialogHeader>{Boolean(actionError)&&<p role="alert" className="text-red-700">{adminErrorText(actionError,ru)}</p>}<Button disabled={busy} onClick={()=>void changeAccess()}>{busy?text('Сохраняем…','Saqlanmoqda…'):text('Подтвердить','Tasdiqlash')}</Button></DialogContent></Dialog>
 </>;
}
