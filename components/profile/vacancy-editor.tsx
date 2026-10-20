'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useLanguage} from '@/contexts/language-context';
import {AccountGate} from './account-gate';
import {VacancyLayout} from './vacancy-layout';
import {adminErrorText} from '@/lib/admin-api';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {LocationSelect} from '@/components/ui/location-select';
import {JobMap} from '@/components/map/job-map';
import {Loader2} from '@/components/ui/icons';
import {AlertDialog,AlertDialogContent,AlertDialogTrigger,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {accountApi,AccountApiError} from '@/lib/account-api';
import {vacancyErrorText,type Vacancy} from '@/lib/vacancy-api';
import {supabase} from '@/lib/supabase';
import {REGION_COORDINATES,UZBEKISTAN_CENTER} from '@/lib/constants';
import {VacancyAI} from './vacancy-ai';
const defaults:Record<string,any>={company_name:'',title_uz:'',title_ru:'',description_uz:'',description_ru:'',requirements_uz:'',requirements_ru:'',benefits:'',category_id:'',region_id:'',district_id:'',salary_min:'',salary_max:'',employment_type:'full_time',work_mode:'onsite',payment_type:'3',experience:'no_experience',education_level:'any',gender:'any',age_min:'',age_max:'',contact_phone:'',contact_telegram:'',address:'',latitude:'',longitude:'',skills:[],languages:[],is_for_students:false,is_for_disabled:false,is_for_women:false};
const options:Record<string,Array<[string,string,string]>>={
 employment_type:[['full_time','Полная занятость','To‘liq bandlik'],['part_time','Частичная занятость','Qisman bandlik'],['contract','По договору','Shartnoma'],['internship','Стажировка','Stajirovka'],['remote','Удалённая работа','Masofaviy ish']],
 work_mode:[['onsite','На месте','Ish joyida'],['remote','Удалённо','Masofaviy'],['hybrid','Гибридный формат','Gibrid']],
 payment_type:[['3','Фиксированный оклад','Stavka (oklad)'],['2','Сдельная','Ishbay'],['4','По договору','Shartnoma'],['1','По договорённости','Kelishiladi']],
 experience:[['no_experience','Без опыта','Tajriba talab qilinmaydi'],['1_year','1 год','1 yil'],['1_3_years','1–3 года','1–3 yil'],['3_5_years','3–5 лет','3–5 yil'],['5_plus','Более 5 лет','5 yildan ortiq']],
 education_level:[['any','Любое','Ahamiyatsiz'],['secondary','Среднее','O‘rta'],['vocational','Среднее специальное','O‘rta maxsus'],['higher','Высшее','Oliy'],['master','Магистратура','Magistratura']],
 gender:[['any','Любой','Ahamiyatsiz'],['male','Мужской','Erkak'],['female','Женский','Ayol']],
};
const numeric=['region_id','district_id','salary_min','salary_max','age_min','age_max','latitude','longitude'];
const languageLevels:Record<string,[string,string]>={A1:['A1','A1'],A2:['A2','A2'],B1:['B1','B1'],B2:['B2','B2'],C1:['C1','C1'],C2:['C2','C2'],native:['Родной язык','Ona tili'],fluent:['Свободно','Erkin'],basic:['Начальный','Boshlang‘ich'],intermediate:['Средний','O‘rta'],advanced:['Продвинутый','Yuqori']};
function formOf(row:any) {
 const form={...defaults};for(const key of Object.keys(defaults))if(row[key]!=null)form[key]=Array.isArray(defaults[key])?row[key]:typeof defaults[key]==='boolean'?row[key]===true:String(row[key]);
 return form;
}
export function VacancyEditorPage({id}:{id?:string}){return <AccountGate role="employer"><VacancyEditor key={id||'new'} id={id}/></AccountGate>;}
export function VacancyEditor({id,api=accountApi,basePath='/api/account/vacancies',listPath='/profile/employer/vacancies',admin=false}:{id?:string;api?:typeof accountApi;basePath?:string;listPath?:string;admin?:boolean}) {
 const {lang}=useLanguage(),ru=lang==='ru',router=useRouter();
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState<{revision:number;row:Vacancy|null;employer:any;error:unknown}|null>(null),[form,setForm]=useState<Record<string,any>>(defaults);
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState<unknown>(null),[saved,setSaved]=useState(false),[skill,setSkill]=useState('');
 const [referenceRevision,setReferenceRevision]=useState(0),[reference,setReference]=useState<{revision:number;categories:any[];error:boolean}|null>(null);
 const requestId=useRef<string|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  const job=id?api<{vacancy:Vacancy}>(`${basePath}/${id}`,{signal:controller.signal}):Promise.resolve({vacancy:null});
  Promise.all([job,api<{employer:any}>(`${basePath}/prefill`,{signal:controller.signal})])
   .then(([result,prefill])=>{if(!cancelled){setLoaded({revision,row:result.vacancy,employer:prefill.employer,error:null});setForm(formOf(result.vacancy||prefill.employer));setSaveError(null);setSaved(false);}})
   .catch(error=>{if(!cancelled)setLoaded({revision,row:null,employer:null,error});});
  return()=>{cancelled=true;controller.abort();};
 },[id,revision,api,basePath]);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  supabase.from('categories').select('id,name_uz,name_ru').order('name_uz').abortSignal(controller.signal)
   .then(({data,error})=>{if(!cancelled)setReference({revision:referenceRevision,categories:data||[],error:Boolean(error)});},()=>{if(!cancelled)setReference({revision:referenceRevision,categories:[],error:true});});
  return()=>{cancelled=true;controller.abort();};
 },[referenceRevision]);
 const current=loaded?.revision===revision?loaded:null,refReady=reference?.revision===referenceRevision,categories=refReady?reference.categories:[];
 const change=(patch:Record<string,any>)=>{setForm(previous=>({...previous,...patch}));setSaved(false);};
 const save=async(draft:boolean)=>{
  if(lock.current||!current?.employer)return;
  lock.current=true;setSaving(true);setSaveError(null);setSaved(false);
  requestId.current ||= crypto.randomUUID();
  const payload:Record<string,any>={...form,...Object.fromEntries(numeric.map(key=>[key,form[key]===''||form[key]==null?null:Number(form[key])])),request_id:requestId.current,status:draft?'draft':'active',expected_updated_at:current.row?.updated_at??null};
  try {
   const result=await api<{vacancy:Vacancy}>(id?`${basePath}/${id}`:basePath,{method:id?'PUT':'POST',body:JSON.stringify(payload)});
   if(!alive.current)return;
   if(!result.vacancy?.id||id&&result.vacancy.id!==id)throw new AccountApiError(503);
   if(!id){router.push(admin||status!=='active'?listPath:`/profile/employer/vacancies/${result.vacancy.id}/promotion`);return;}
   setLoaded({...current,row:result.vacancy});setForm(formOf(result.vacancy));setSaved(true);
  } catch(error){if(alive.current)setSaveError(error);}
  finally{lock.current=false;if(alive.current)setSaving(false);}
 };
 const input=(key:string,russian:string,uzbek:string,type='text',max=255)=><div className="space-y-2"><Label htmlFor={`vacancy-${key}`}>{ru?russian:uzbek}</Label><Input id={`vacancy-${key}`} value={form[key]} type={type} step={key==='latitude'||key==='longitude'?'any':undefined} disabled={saving} maxLength={max} onChange={event=>change({[key]:event.target.value})} className="rounded-xl"/></div>;
 const area=(key:string,russian:string,uzbek:string,max=20000)=><div className="space-y-2"><Label htmlFor={`vacancy-${key}`}>{ru?russian:uzbek}</Label><Textarea id={`vacancy-${key}`} value={form[key]} disabled={saving} maxLength={max} onChange={event=>change({[key]:event.target.value})} className="min-h-28 rounded-xl"/></div>;
 const select=(key:string,russian:string,uzbek:string)=><div className="space-y-2"><Label htmlFor={`vacancy-${key}`}>{ru?russian:uzbek}</Label><select id={`vacancy-${key}`} value={form[key]} disabled={saving} onChange={event=>change({[key]:event.target.value})} className="h-11 rounded-xl border border-border bg-card px-3 w-full text-sm">
   {!options[key].some(([value])=>value===form[key])&&<option value={form[key]}>{form[key]}</option>}{options[key].map(([value,russian,uzbek])=><option value={value} key={value}>{ru?russian:uzbek}</option>)}
  </select></div>;
 const addSkill=()=>{const value=skill.trim();if(!value||form.skills.includes(value)||form.skills.length>=50)return;change({skills:[...form.skills,value]});setSkill('');};
 const applyAI=(result:Record<string,any>)=>{
  const patch:Record<string,any>={};for(const key of ['title_uz','title_ru','description_uz','description_ru','requirements_uz','requirements_ru','benefits'])if(typeof result[key]==='string')patch[key]=result[key];
  for(const key of ['salary_min','salary_max'])if(result[key]===null||Number.isSafeInteger(result[key])&&result[key]>=0&&result[key]<=2147483647)patch[key]=result[key]??'';
  for(const key of ['employment_type','work_mode','payment_type'])if(options[key].some(([value])=>value===String(result[key])))patch[key]=String(result[key]);
  if(Array.isArray(result.skills)&&result.skills.every((value:unknown)=>typeof value==='string'))patch.skills=result.skills.slice(0,50);
  change(patch);
 };
 const coordinates=form.latitude!==''&&form.longitude!==''&&Number.isFinite(Number(form.latitude))&&Number.isFinite(Number(form.longitude))?{lat:Number(form.latitude),lng:Number(form.longitude)}:null;
 const center=REGION_COORDINATES[Number(form.region_id)]||UZBEKISTAN_CENTER;
 return <VacancyLayout admin={admin}><div className="space-y-6">
  <Link href={listPath} className="text-primary underline text-sm">{ru?'К списку вакансий':'Vakansiyalar ro‘yxatiga'}</Link>
  <h1 className="text-2xl font-semibold text-foreground">{id?(ru?'Редактировать вакансию':'Vakansiyani tahrirlash'):(ru?'Новая вакансия':'Yangi vakansiya')}</h1>
  {!current?<div role="status" className="flex gap-3 justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary"/>{ru?'Загружаем форму…':'Forma yuklanmoqda…'}</div>:current.error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3"><p>{admin?adminErrorText(current.error,ru):vacancyErrorText(current.error,lang)}</p><Button variant="outline" onClick={()=>setRevision(value=>value+1)}>{ru?'Повторить загрузку':'Qayta yuklash'}</Button></div>:
  <form className="space-y-5" onSubmit={event=>{event.preventDefault();void save(false);}}>
   <fieldset disabled={saving} className="space-y-5">
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5"><h2 className="text-xl font-semibold">{ru?'Основная информация':'Asosiy ma’lumotlar'}</h2>
     {admin?input('company_name','Компания','Kompaniya'):<div className="space-y-2"><Label htmlFor="vacancy-company">{ru?'Компания':'Kompaniya'}</Label><Input id="vacancy-company" readOnly value={current.employer.company_name||''} className="rounded-xl bg-background"/><p className="text-sm text-muted-foreground">{ru?'Название компании берётся из профиля.':'Kompaniya nomi profildan olinadi.'} <Link href="/profile/employer" className="text-primary underline">{ru?'Открыть профиль':'Profilni ochish'}</Link></p></div>}
     <p className="text-sm text-muted-foreground">{ru?'Название и описание достаточно заполнить на одном языке. Второй язык можно добавить позже.':'Nom va tavsifni bitta tilda to‘ldirish yetarli. Ikkinchi tilni keyin qo‘shish mumkin.'}</p>
     <div className="grid sm:grid-cols-2 gap-5">{input('title_uz','Название — O‘zbekcha','Nom — O‘zbekcha')}{input('title_ru','Название — Русский','Nom — Русский')}</div>
     <div className="space-y-2"><Label htmlFor="vacancy-category">{ru?'Отрасль':'Soha'}</Label><select id="vacancy-category" value={form.category_id} disabled={saving||!refReady} onChange={event=>change({category_id:event.target.value})} className="w-full h-11 rounded-xl border border-border px-3"><option value="">{ru?'Выберите отрасль':'Sohani tanlang'}</option>{form.category_id&&!categories.some(row=>row.id===form.category_id)&&<option value={form.category_id}>{ru?'Сохранённая отрасль':'Saqlangan soha'}</option>}{categories.map(row=><option value={row.id} key={row.id}>{ru?row.name_ru||row.name_uz:row.name_uz||row.name_ru}</option>)}</select></div>
     {refReady&&reference.error&&<div role="alert" className="text-sm text-red-700 space-y-2"><p>{ru?'Не удалось загрузить отрасли.':'Sohalarni yuklab bo‘lmadi.'}</p><Button type="button" variant="outline" onClick={()=>setReferenceRevision(value=>value+1)}>{ru?'Повторить отрасли':'Sohalarni qayta yuklash'}</Button></div>}
     <VacancyAI onApply={applyAI} api={api} endpoint={admin?'/api/admin/ai/vacancy-helper':'/api/ai/vacancy-helper'}/><div className="grid sm:grid-cols-2 gap-5">{area('description_uz','Описание — O‘zbekcha','Tavsif — O‘zbekcha')}{area('description_ru','Описание — Русский','Tavsif — Русский')}{area('requirements_uz','Требования и задачи — O‘zbekcha','Talablar va vazifalar — O‘zbekcha')}{area('requirements_ru','Требования и задачи — Русский','Talablar va vazifalar — Русский')}</div>{area('benefits','Что вы предлагаете сотруднику','Xodimga nimalarni taklif qilasiz',10000)}
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5"><h2 className="text-xl font-semibold">{ru?'Условия и оплата':'Shartlar va to‘lov'}</h2><div className="grid sm:grid-cols-2 gap-5">{select('employment_type','Занятость','Bandlik')}{select('work_mode','Формат работы','Ish shakli')}{select('payment_type','Форма оплаты','To‘lov shakli')}{select('experience','Опыт работы','Ish tajribasi')}</div>
     <div className="grid sm:grid-cols-2 gap-5">{input('salary_min','Зарплата от, сум','Eng kam maosh, so‘m','number')}{input('salary_max','Зарплата до, сум','Eng ko‘p maosh, so‘m','number')}</div>
     <div className="grid sm:grid-cols-2 gap-5">{select('education_level','Образование','Ma’lumot')}{select('gender','Пол','Jins')}{input('age_min','Возраст от (необязательно)','Eng kichik yosh (ixtiyoriy)','number')}{input('age_max','Возраст до (необязательно)','Eng katta yosh (ixtiyoriy)','number')}</div>
     <div className="flex flex-wrap gap-4">{[['is_for_students','Подходит студентам','Talabalarga mos'],['is_for_disabled','Доступно людям с инвалидностью','Nogironligi bo‘lgan shaxslarga mos'],['is_for_women','Подходит женщинам','Ayollarga mos']].map(([key,russian,uzbek])=><label key={key} className="flex gap-2 text-sm items-center"><input type="checkbox" checked={form[key]} onChange={event=>change({[key]:event.target.checked})}/>{ru?russian:uzbek}</label>)}</div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5"><h2 className="text-xl font-semibold">{ru?'Навыки и языки':'Ko‘nikmalar va tillar'}</h2>
     <div className="flex flex-wrap gap-2">{form.skills.map((value:string,index:number)=><span key={`${index}:${value}`} className="rounded-full bg-accent text-primary text-sm px-3 py-1 flex items-center gap-2">{value}<button type="button" aria-label={`${ru?'Убрать навык':'Ko‘nikmani olib tashlash'}: ${value}`} onClick={()=>change({skills:form.skills.filter((_:string,i:number)=>i!==index)})}>×</button></span>)}</div>
     <div className="space-y-2"><Label htmlFor="vacancy-skill">{ru?'Добавить навык':'Ko‘nikma qo‘shish'}</Label><div className="flex gap-2"><Input id="vacancy-skill" value={skill} maxLength={100} onChange={event=>setSkill(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSkill();}}}/><Button type="button" variant="outline" disabled={!skill.trim()||form.skills.length>=50} onClick={addSkill}>{ru?'Добавить':'Qo‘shish'}</Button></div></div>
     {form.languages.map((row:any,index:number)=><div key={index} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"><div className="space-y-2"><Label htmlFor={`vacancy-language-${index}`}>{ru?'Язык':'Til'} {index+1}</Label><Input id={`vacancy-language-${index}`} value={row.language} maxLength={100} onChange={event=>change({languages:form.languages.map((item:any,i:number)=>i===index?{...item,language:event.target.value}:item)})}/></div><div className="space-y-2"><Label htmlFor={`vacancy-level-${index}`}>{ru?'Уровень':'Daraja'} {index+1}</Label><select id={`vacancy-level-${index}`} value={row.level} onChange={event=>change({languages:form.languages.map((item:any,i:number)=>i===index?{...item,level:event.target.value}:item)})} className="h-11 border border-border rounded-xl px-3 w-full"><option value="">{ru?'Не указан':'Ko‘rsatilmagan'}</option>{['A1','A2','B1','B2','C1','C2','native','fluent','basic','intermediate','advanced'].includes(row.level)||!row.level?null:<option value={row.level}>{row.level}</option>}{Object.entries(languageLevels).map(([value,label])=><option key={value} value={value}>{label[ru?0:1]}</option>)}</select></div><Button variant="outline" type="button" onClick={()=>change({languages:form.languages.filter((_:any,i:number)=>i!==index)})}>{ru?'Убрать язык':'Tilni olib tashlash'}</Button></div>)}
     <Button type="button" variant="outline" disabled={form.languages.length>=20} onClick={()=>change({languages:[...form.languages,{language:'',level:''}]})}>{ru?'Добавить язык':'Til qo‘shish'}</Button>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5"><h2 className="text-xl font-semibold">{ru?'Место работы и контакты':'Ish joyi va aloqa'}</h2><LocationSelect selectedRegion={form.region_id} selectedDistrict={form.district_id} onRegionChange={region_id=>change({region_id,district_id:'',...(String(region_id)!==String(form.region_id)?{latitude:'',longitude:''}:{})})} onDistrictChange={district_id=>change({district_id})}/>{input('address','Адрес','Manzil','text',1000)}
     <p className="text-sm text-muted-foreground">{ru?'Точка на карте необязательна. Её можно указать нажатием на карту или координатами. Для удалённой работы регион можно оставить пустым.':'Xaritadagi nuqta ixtiyoriy. Xaritani bosib yoki koordinatalarni kiritib belgilang. Masofaviy ish uchun viloyatni bo‘sh qoldirish mumkin.'}</p>
     <JobMap jobs={[]} interactive onMapClick={(latitude,longitude)=>change({latitude:String(latitude),longitude:String(longitude)})} markerPosition={coordinates} center={center} height="300px" zoom={form.region_id?9:6}/>
     <div className="grid sm:grid-cols-2 gap-5">{input('latitude','Широта (необязательно)','Kenglik (ixtiyoriy)','number')}{input('longitude','Долгота (необязательно)','Uzunlik (ixtiyoriy)','number')}</div><Button type="button" variant="outline" onClick={()=>change({latitude:'',longitude:''})}>{ru?'Убрать точку на карте':'Xaritadagi nuqtani olib tashlash'}</Button>
     <div className="grid sm:grid-cols-2 gap-5">{input('contact_phone','Контактный телефон','Aloqa telefoni','tel',25)}{input('contact_telegram','Telegram (необязательно)','Telegram (ixtiyoriy)','text',100)}</div>
    </section>
   </fieldset>
   {saveError!=null&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-5 space-y-3"><p>{admin?adminErrorText(saveError,ru):vacancyErrorText(saveError,lang)}</p><p className="text-sm">{ru?'Введённые данные остаются в форме.':'Kiritilgan ma’lumotlar formada qoladi.'}</p>{id&&saveError instanceof AccountApiError&&saveError.status===409&&<AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline">{ru?'Загрузить актуальную вакансию':'Joriy vakansiyani yuklash'}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{ru?'Обновить форму?':'Forma yangilansinmi?'}</AlertDialogTitle><AlertDialogDescription>{ru?'Несохранённые изменения будут заменены данными из вакансии.':'Saqlanmagan o‘zgarishlar vakansiyadagi ma’lumotlar bilan almashtiriladi.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{ru?'Оставить форму':'Formani saqlab qolish'}</AlertDialogCancel><AlertDialogAction onClick={()=>setRevision(value=>value+1)}>{ru?'Обновить':'Yangilash'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>}
   {saved&&<p role="status" className="text-primary">{ru?'Изменения сохранены. Статус публикации не изменён.':'O‘zgarishlar saqlandi. E’lon holati o‘zgarmadi.'}</p>}
   <div className="flex flex-wrap justify-end gap-3">{!id&&<Button type="button" variant="outline" disabled={saving} onClick={()=>void save(true)}>{ru?'Сохранить черновик':'Qoralamani saqlash'}</Button>}<Button type="submit" disabled={saving||current.row?.status==='archived'}>{saving?(ru?'Сохраняем…':'Saqlanmoqda…'):id?(ru?'Сохранить изменения':'O‘zgarishlarni saqlash'):(ru?'Опубликовать вакансию':'Vakansiyani e’lon qilish')}</Button></div>
  </form>}
 </div></VacancyLayout>;
}
