'use client';
import {useEffect,useRef,useState} from 'react';
import {AdminGate,AdminLayout,useAdminApi} from './admin-gate';
import {useAdminData} from './admin-data';
import {useLanguage} from '@/contexts/language-context';
import {Button} from '@/components/ui/button';
import {adminErrorText} from '@/lib/admin-api';
import {importProgress,type ImportProgress} from '@/lib/import/progress';

type Command={action:'start';request_id:string}|{action:'continue';run_id:string;iteration:number};
const endpoint='/api/admin/import';
function Importer(){
 const {lang}=useLanguage(),ru=lang==='ru',api=useAdminApi();
 const {data,loading,error:loadError,reload}=useAdminData<{progress:ImportProgress|null}>(endpoint);
 const [local,setLocal]=useState<ImportProgress|null>(null),[command,setCommand]=useState<Command|null>(null),[error,setError]=useState<unknown>(null);
 const startRequest=useRef<string|null>(null),progress=local??data?.progress??null;
 useEffect(()=>{
  if(!command)return;
  let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();
  const pause=()=>{if(document.hidden)setCommand(null);};document.addEventListener('visibilitychange',pause);
  const body=command.action==='start'?command:{action:'continue',run_id:command.run_id};
  api<{progress:ImportProgress}>(endpoint,{method:'POST',body:JSON.stringify(body),signal:controller.signal}).then(result=>{
   if(cancelled)return;const next=importProgress(result.progress);startRequest.current=null;setLocal(next);setError(null);
   if(next.state!=='running'){setCommand(null);return;}
   const until=next.next_retry_at?Date.parse(next.next_retry_at)-Date.now():0;
   const delay=next.phase==='details'&&until>0?Math.max(3000,Math.min(30000,until)):3000;
   timer=setTimeout(()=>{if(!cancelled)setCommand({action:'continue',run_id:next.id,iteration:command.action==='continue'?command.iteration+1:1});},delay);
  }).catch(async failure=>{
   if(cancelled)return;
   setError(failure);
   // A lost response can still have committed. Read its durable state before
   // offering a retry; reuse the original start id if no run can be confirmed.
   try{const current=await api<{progress:ImportProgress|null}>(endpoint,{signal:controller.signal});if(!cancelled&&current.progress){setLocal(importProgress(current.progress));startRequest.current=null;}}catch{}
   if(!cancelled)setCommand(null);
  });
  return()=>{cancelled=true;controller.abort();if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',pause);};
 },[api,command]);
 const phases={list:ru?'Получаем список':'Ro‘yxat olinmoqda',details:ru?'Обновляем вакансии':'Vakansiyalar yangilanmoqda',verify:ru?'Проверяем полный список':'To‘liq ro‘yxat tekshirilmoqda',done:ru?'Завершено':'Yakunlandi'};
 const states={running:ru?'В процессе':'Jarayonda',completed:ru?'Завершён':'Yakunlangan',failed:ru?'Остановлен из-за ошибки':'Xato sabab to‘xtagan',abandoned:ru?'Прерван':'To‘xtatilgan'};
 const errorMessages:Record<string,[string,string]>={source_unavailable:['Источник временно недоступен. Прогресс сохранён.','Manba vaqtincha mavjud emas. Jarayon saqlandi.'],detail_unavailable:['Не удалось проверить часть вакансий. Начните новый импорт позже.','Ayrim vakansiyalarni tekshirib bo‘lmadi. Keyinroq yangi import boshlang.'],snapshot_changed:['Список источника изменился. Начните новый импорт.','Manba ro‘yxati o‘zgardi. Yangi import boshlang.'],snapshot_expired:['Проверка заняла больше суток. Начните новый импорт.','Tekshiruv bir sutkadan oshdi. Yangi import boshlang.'],permission_changed:['Права администратора изменились. Обновите доступ.','Administrator huquqlari o‘zgardi. Kirishni yangilang.'],write_failed:['Не удалось сохранить часть данных. Прогресс сохранён.','Ayrim ma’lumotlarni saqlab bo‘lmadi. Jarayon saqlandi.'],invalid_data:['Источник вернул неподходящие данные. Повторите позже.','Manbadan mos bo‘lmagan ma’lumot keldi. Keyinroq takrorlang.']};
 function start(){setError(null);startRequest.current??=crypto.randomUUID();setCommand({action:'start',request_id:startRequest.current});}
 function resume(){if(progress){setError(null);setCommand({action:'continue',run_id:progress.id,iteration:0});}}
 const counters=progress?[[ru?'Найдено в списке':'Ro‘yxatda topildi',progress.listed],[ru?'Проверено вакансий':'Tekshirilgan vakansiyalar',progress.processed],[ru?'Добавлено':'Qo‘shildi',progress.new_imported],[ru?'Обновлено':'Yangilandi',progress.updated],[ru?'Сохранено без правок: закрытые аккаунты':'Yopiq akkauntlar: o‘zgartirilmagan',progress.skipped_closed],[ru?'Повторно проверено в списке':'Ro‘yxatda qayta tekshirildi',progress.verified]]:[];
 return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-medium text-teal-700">OsonIsh</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{ru?'Импорт вакансий':'Vakansiyalar importi'}</h1><p className="mt-3 text-slate-600">{ru?'Обновление вакансий по всему Узбекистану. Ручные правки и отклики сохраняются. Исчезнувшие вакансии снимаются с показа после полной проверки источника.':'O‘zbekiston bo‘ylab vakansiyalarni yangilash. Qo‘lda kiritilgan o‘zgarishlar va arizalar saqlanadi. Yo‘qolgan vakansiyalar manba to‘liq tekshirilgandan keyin yashiriladi.'}</p></div>
  {Boolean(error||loadError)&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{adminErrorText(error||loadError,ru)}</div>}
  {loading&&!progress?<p role="status">{ru?'Загружаем состояние…':'Holat yuklanmoqda…'}</p>:<section aria-label={ru?'Состояние импорта':'Import holati'} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-5">
   {progress?<><div aria-live="polite"><h2 className="text-lg font-semibold">{states[progress.state]}</h2><p className="mt-1 text-slate-600">{phases[progress.phase]}{progress.total!==null?` · ${progress.processed} / ${progress.total}`:''}</p></div><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{counters.map(([label,value])=><div key={String(label)} className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-semibold text-sky-800">{Number(value).toLocaleString(ru?'ru-RU':'uz-UZ')}</dd></div>)}</dl>{progress.last_error&&<p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">{errorMessages[progress.last_error]?.[ru?0:1]||(ru?'Возникла ошибка. Проверьте состояние и повторите позже.':'Xato yuz berdi. Holatni tekshirib, keyinroq takrorlang.')}</p>}{progress.state==='running'&&<p className="text-sm text-slate-600">{command?(ru?'Обработка продолжается, пока эта вкладка открыта.':'Ushbu sahifa ochiq turganda jarayon davom etadi.'):(ru?'Прогресс сохранён. Продолжите обработку с текущего места.':'Jarayon saqlandi. Joriy joydan davom ettiring.')}</p>}</>:<p className="text-slate-600">{ru?'Импорт ещё не запускался.':'Import hali boshlanmagan.'}</p>}
   <div className="flex flex-wrap gap-3">{command?<Button variant="outline" onClick={()=>setCommand(null)}>{ru?'Приостановить обработку в этой вкладке':'Ushbu sahifada qayta ishlashni to‘xtatish'}</Button>:progress?.state==='running'?<Button onClick={resume}>{ru?'Продолжить импорт':'Importni davom ettirish'}</Button>:<Button onClick={start} disabled={Boolean(loadError)}>{ru?'Начать импорт':'Importni boshlash'}</Button>}<Button variant="outline" disabled={Boolean(command)} onClick={()=>{setLocal(null);setError(null);reload();}}>{ru?'Обновить состояние':'Holatni yangilash'}</Button></div>
   <p className="text-sm text-slate-500">{ru?'Закрытие вкладки останавливает продолжение из браузера. Сохранённый прогресс доступен при следующем входе; серверное расписание, если оно настроено, работает отдельно.':'Sahifa yopilganda brauzerdagi davom ettirish to‘xtaydi. Saqlangan jarayon keyingi kirishda mavjud; server jadvali sozlangan bo‘lsa, u alohida ishlaydi.'}</p>
  </section>}
 </div>;
}
export function AdminImport(){return <AdminGate superOnly><AdminLayout><Importer/></AdminLayout></AdminGate>;}
