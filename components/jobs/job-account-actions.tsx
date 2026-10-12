'use client';
import {useEffect,useRef,useState} from 'react';
import {useUserAuth} from '@/contexts/user-auth-context';
import {useAuthModal} from '@/contexts/auth-modal-context';
import {useLanguage} from '@/contexts/language-context';
import {accountApi,AccountApiError} from '@/lib/account-api';
import {Button} from '@/components/ui/button';
import {Star,Loader2} from '@/components/ui/icons';
import {ApplicationModal} from './application-modal';
import {savedJobsError} from '@/components/profile/saved-jobs';
type Job={id:string;title:string;company_name:string;is_imported?:boolean|null};
export function JobAccountActions({job}:{job:Job}){
 const {user}=useUserAuth();return <Actions key={`${job.id}:${user?.id||'guest'}:${user?.active_role||'job_seeker'}`} job={job}/>;
}
function Actions({job}:{job:Job}){
 const {user}=useUserAuth(),{openModal}=useAuthModal(),{lang}=useLanguage(),ru=lang==='ru',seeker=user?.active_role!=='employer';
 const [revision,setRevision]=useState(0),[snapshot,setSnapshot]=useState<{revision:number;favorite:boolean;applied:boolean}|null>(null),[error,setError]=useState<unknown>(null),[historyError,setHistoryError]=useState(false),[historyRevision,setHistoryRevision]=useState(0),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
 const alive=useRef(true),lock=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!user||!seeker)return;let cancelled=false;const controller=new AbortController();accountApi<{favorite:boolean;applied:boolean}>(`/api/account/jobs/${job.id}`,{signal:controller.signal}).then(result=>{if(!cancelled){if(typeof result.favorite!=='boolean'||typeof result.applied!=='boolean')throw new AccountApiError(503);setSnapshot({...result,revision});setError(null);}}).catch(error=>{if(!cancelled)setError(error);});return()=>{cancelled=true;controller.abort();};},[user,seeker,job.id,revision]);
 useEffect(()=>{if(!user||!seeker)return;let cancelled=false;accountApi<{recorded:boolean}>('/api/account/history',{method:'POST',body:JSON.stringify({job_id:job.id})}).then(result=>{if(!cancelled){if(result.recorded!==true)throw new AccountApiError(503);setHistoryError(false);}}).catch(()=>{if(!cancelled)setHistoryError(true);});return()=>{cancelled=true;};},[user,seeker,job.id,historyRevision]);
 const current=snapshot?.revision===revision?snapshot:null;
 const toggle=async()=>{if(!user){openModal();return;}if(lock.current||!current)return;lock.current=true;setBusy(true);setError(null);try{
  const result=await accountApi<{favorite:boolean}>('/api/account/favorites',{method:'PUT',body:JSON.stringify({job_id:job.id,favorite:!current.favorite})});if(!alive.current)return;if(result.favorite!==!current.favorite)throw new AccountApiError(503);setSnapshot(previous=>previous?.revision===revision?{...previous,favorite:result.favorite}:previous);
 }catch(error){if(alive.current)setError(error);}finally{lock.current=false;if(alive.current)setBusy(false);}};
 if(!seeker)return null;
 return <div className="space-y-3"><div className="flex flex-wrap gap-3">
  <Button variant="outline" onClick={()=>void toggle()} disabled={busy||!!user&&!current} aria-label={current?.favorite?(ru?'Убрать из избранного':'Sevimlilardan olib tashlash'):(ru?'Добавить в избранное':'Sevimlilarga qo‘shish')} aria-pressed={current?.favorite??false} className="rounded-xl bg-white text-sky-800 border-slate-200">{busy?<Loader2 className="h-5 w-5 animate-spin"/>:<Star className={`h-5 w-5 ${current?.favorite?'fill-current':''}`}/>}</Button>
  <Button onClick={()=>user?setOpen(true):openModal()} disabled={Boolean(job.is_imported)||!!user&&!current||current?.applied} className="rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 text-white">{current?.applied?(ru?'Заявка отправлена':'Ariza yuborilgan'):(ru?'Откликнуться':'Ariza yuborish')}</Button>
 </div>{job.is_imported&&<p className="text-xs text-slate-400">{ru?'Из другого источника: используйте контакты в вакансии.':'Boshqa manbadan olingan: vakansiyadagi aloqadan foydalaning.'}</p>}
 {error!=null&&<div role="alert" className="rounded-xl bg-white p-3 text-sm text-red-700 space-y-2"><p>{savedJobsError(error,ru)}</p>{!current&&<Button variant="outline" onClick={()=>{setError(null);setRevision(value=>value+1);}}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button>}</div>}
 {historyError&&<div role="alert" className="rounded-xl bg-white p-3 text-sm text-slate-700 space-y-2"><p>{ru?'Не удалось сохранить просмотр в историю.':'Ko‘rishni tarixga saqlab bo‘lmadi.'}</p><Button variant="outline" onClick={()=>setHistoryRevision(value=>value+1)}>{ru?'Повторить сохранение просмотра':'Ko‘rishni qayta saqlash'}</Button></div>}
 <ApplicationModal isOpen={open} onClose={()=>setOpen(false)} job={job} onSuccess={()=>setSnapshot(previous=>previous?.revision===revision?{...previous,applied:true}:previous)}/>
 </div>;
}
