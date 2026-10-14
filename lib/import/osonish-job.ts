import type {TransformedVacancy} from '@/lib/scrapers/osonish';
import {mapOsonishCategory,OSONISH_GENDER_MAP} from '@/lib/mappers/osonish-mapper';
import {getMappedValue} from '@/lib/mappings';
export type ImportReferences={regions:Array<{id:number;name_uz:string;name_ru:string;slug?:string}>;districts:Array<{id:number;region_id:number;name_uz:string;name_ru:string}>;categories:Array<{id:string}>};
const normalize=(value:unknown)=>typeof value==='string'?value.toLowerCase().replace(/['`´‘’ʻʼʿʾ]/g,'').replace(/[^a-zа-яёўқғҳ0-9]+/g,' ').trim():'';
const names=(row:{name_uz:string;name_ru:string})=>[normalize(row.name_uz),normalize(row.name_ru)].filter(Boolean);
const one=<T,>(rows:T[])=>rows.length===1?rows[0]:undefined;
const regionAliases:Record<string,string>={andijon:'andijon',andijan:'andijon',андижан:'andijon',buxoro:'buxoro',bukhara:'buxoro',бухара:'buxoro',fargona:'fargona',fergana:'fargona',фергана:'fargona',jizzax:'jizzax',jizzakh:'jizzax',джизак:'jizzax',xorazm:'xorazm',khorezm:'xorazm',хорезм:'xorazm',namangan:'namangan',наманган:'namangan',navoiy:'navoiy',navoi:'navoiy',навои:'navoiy',qashqadaryo:'qashqadaryo',kashkadarya:'qashqadaryo',кашкадарья:'qashqadaryo',qoraqalpogiston:'qoraqalpogiston',karakalpakstan:'qoraqalpogiston',каракалпакстан:'qoraqalpogiston',samarqand:'samarqand',samarkand:'samarqand',самарканд:'samarqand',sirdaryo:'sirdaryo',syrdarya:'sirdaryo',сырдарья:'sirdaryo',surxondaryo:'surxondaryo',surkhandarya:'surxondaryo',сурхандарья:'surxondaryo',toshkent:'toshkent',tashkent:'toshkent',ташкент:'toshkent'};
function regionBase(value:string){return Object.keys(regionAliases).find(key=>value.split(' ').includes(key));}
const districtBase=(value:string)=>value.replace(/\b(tumani|tuman|shahri|shahar|shaxar|sh)\b|район|город|тумани|шахри/g,' ').replace(/\s+/g,' ').trim();
export function importLocation(vacancy:TransformedVacancy,refs:ImportReferences){
 const regionName=normalize(vacancy.region_name),districtName=normalize(vacancy.district_name);
 let region=one(refs.regions.filter(row=>names(row).includes(regionName)));
 if(!region&&regionName){const base=regionBase(regionName),key=base?regionAliases[base]:null;
  let candidates=key?refs.regions.filter(row=>names(row).some(name=>{const b=regionBase(name);return b&&regionAliases[b]===key;})):[];
  const city=/\b(shahri|shahar|shaxar)\b|город/.test(regionName),province=/\b(viloyati|viloyat)\b|област/.test(regionName);
  if(city&&!province)candidates=candidates.filter(row=>names(row).some(name=>/\b(shahri|shahar|shaxar)\b|город/.test(name)));
  if(province)candidates=candidates.filter(row=>names(row).some(name=>/\b(viloyati|viloyat)\b|област/.test(name)));
  region=one(candidates);
 }
 const candidates=refs.districts.filter(row=>!region||row.region_id===region.id);
 let district=districtName?one(candidates.filter(row=>names(row).includes(districtName))):undefined;
 if(!district&&districtName){const alias:Record<string,string>={navbaxor:'navbahor',marxamat:'marhamat',muynoq:'moynoq',muynok:'moynoq',dexqonobod:'dehqonobod',dekhqonobod:'dehqonobod',ohongaron:'ohangaron',ohangoron:'ohangaron'};
  const base=districtBase(districtName),target=alias[base]||base;
  district=one(candidates.filter(row=>names(row).some(name=>districtBase(name)===target)));
 }
 if(!region&&district)region=refs.regions.find(row=>row.id===district?.region_id);
 return {region_id:region?.id??null,district_id:district?.id??null,region_name:region?.name_uz||vacancy.region_name||null,district_name:district?.name_uz||vacancy.district_name||null};
}
export function osonishJob(v:TransformedVacancy,refs:ImportReferences){
 const mapped=mapOsonishCategory(v.source_category||'',v.source_subcategory||null,v.title),raw:any=v.raw_source_json||{};
 const benefits=Array.isArray(raw.benefit_ids)?raw.benefit_ids.map((id:unknown)=>typeof id==='number'?getMappedValue('benefits',id,'uz'):null).filter(Boolean).join(', '):'';
 return {source_id:v.source_id,source_url:v.source_url,title_uz:v.title,title_ru:v.title,company_name:v.company_name,
  description_uz:v.description||'',description_ru:v.description||'',salary_min:v.salary_min??null,salary_max:v.salary_max??null,
  ...importLocation(v,refs),address:v.address||null,latitude:v.latitude??null,longitude:v.longitude??null,
  contact_phone:v.contact_phone||null,contact_email:v.contact_email||null,contact_telegram:v.contact_telegram||null,additional_phone:v.additional_phone||null,hr_name:v.hr_name||null,
  gender:typeof v.gender==='number'?(OSONISH_GENDER_MAP[v.gender as keyof typeof OSONISH_GENDER_MAP]||'any'):typeof v.gender==='string'?v.gender:'any',
  age_min:v.age_min??null,age_max:v.age_max??null,education_level:v.education_level??null,
  experience:typeof raw.work_experiance==='number'&&[1,2,3,4,5].includes(raw.work_experiance)?String(raw.work_experiance):null,
  experience_years:v.experience_years??null,
  working_hours:v.working_hours||null,working_days:v.working_days||null,work_mode:v.work_mode||null,payment_type:v.payment_type??null,
  skills:v.skills||[],languages:Array.isArray(raw.languages)?raw.languages:[],sections:raw.sections||null,
  category_id:mapped&&refs.categories.some(row=>row.id===mapped.categoryId)?mapped.categoryId:null,
  vacancy_count:v.vacancy_count??1,is_for_disabled:v.is_for_disabled,is_for_graduates:v.is_for_graduates,is_for_students:v.is_for_students,is_for_women:v.is_for_women,
  benefits:benefits||null,employment_type:v.employment_type||'full_time',raw_source_json:raw,source_category:v.source_category||null,source_subcategory:v.source_subcategory||null};
}
