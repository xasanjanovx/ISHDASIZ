'use client';
import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Label} from '@/components/ui/label';
import {useLanguage} from '@/contexts/language-context';
import {accountApi,AccountApiError} from '@/lib/account-api';
export function VacancyAI({onApply,api=accountApi,endpoint='/api/ai/vacancy-helper'}:{onApply:(result:Record<string,any>)=>void;api?:typeof accountApi;endpoint?:string}) {
 const {lang}=useLanguage(),ru=lang==='ru';
 const [open,setOpen]=useState(false),[prompt,setPrompt]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<Record<string,any>|null>(null),[error,setError]=useState('');
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const generate=async()=>{
  if(lock.current||!prompt.trim())return;lock.current=true;setBusy(true);setError('');setResult(null);
  try {
   const response=await api<{result:Record<string,any>}>(endpoint,{method:'POST',body:JSON.stringify({action:'full_generate',prompt,lang})});
   if(alive.current)setResult(response.result);
  } catch(failure) {
   if(alive.current){const parts=failure instanceof AccountApiError?failure.detail?.split(' / '):null;setError(parts?.[ru?0:1]||(ru?'AI недоступен. Введённый текст сохранён.':'AI mavjud emas. Kiritilgan matn saqlandi.'));}
  } finally {lock.current=false;if(alive.current)setBusy(false);}
 };
 return <><Button variant="outline" type="button" onClick={()=>setOpen(true)}>{ru?'AI: помочь составить вакансию':'AI: vakansiya tuzishda yordam'}</Button>
  <Dialog open={open} onOpenChange={value=>{if(!lock.current)setOpen(value);}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{ru?'Черновик вакансии с AI':'AI bilan vakansiya qoralamasi'}</DialogTitle><DialogDescription>{ru?'Опишите работу и условия. До 3 запросов в час. Проверьте результат перед сохранением.':'Ish va shartlarni tasvirlang. Soatiga 3 ta so‘rovgacha. Saqlashdan oldin natijani tekshiring.'}</DialogDescription></DialogHeader>
   <Label htmlFor="vacancy-ai-prompt">{ru?'Кого вы ищете и что предлагаете?':'Kimni qidiryapsiz va nimalarni taklif qilasiz?'}</Label><Textarea id="vacancy-ai-prompt" value={prompt} maxLength={8000} disabled={busy} onChange={event=>setPrompt(event.target.value)} className="min-h-32"/>
   {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
   {result&&<div className="space-y-3"><pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm max-h-64 overflow-y-auto">{Object.entries(result).map(([key,value])=>{
     const labels:Record<string,string>={title_uz:'O‘zbekcha — '+(ru?'название':'nom'),title_ru:'Русский — '+(ru?'название':'nom'),description_uz:'O‘zbekcha — '+(ru?'описание':'tavsif'),description_ru:'Русский — '+(ru?'описание':'tavsif'),requirements_uz:'O‘zbekcha — '+(ru?'требования':'talablar'),requirements_ru:'Русский — '+(ru?'требования':'talablar'),benefits:ru?'Условия':'Shartlar',skills:ru?'Навыки':'Ko‘nikmalar',salary_min:ru?'Зарплата от':'Eng kam maosh',salary_max:ru?'Зарплата до':'Eng ko‘p maosh'};
     return labels[key]?`${labels[key]}: ${Array.isArray(value)?value.join(', '):value??'—'}`:null;
    }).filter(Boolean).join('\n\n')}</pre><Button type="button" onClick={()=>{onApply(result);setOpen(false);}}>{ru?'Использовать черновик в форме':'Qoralamani formaga qo‘llash'}</Button></div>}
   <div className="flex gap-3 justify-end"><Button variant="outline" type="button" disabled={busy} onClick={()=>setOpen(false)}>{ru?'Закрыть':'Yopish'}</Button><Button type="button" disabled={busy||!prompt.trim()} onClick={()=>void generate()}>{busy?(ru?'Готовим…':'Tayyorlanmoqda…'):(ru?'Подготовить черновик':'Qoralama tayyorlash')}</Button></div>
  </DialogContent></Dialog>
 </>;
}
