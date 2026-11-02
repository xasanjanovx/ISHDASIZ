import {miniHash} from './ai';
import {getJobWorkMode} from '@/lib/work-mode';
import {normalizeExperienceCode} from '@/lib/experience-compat';
export const salaryNormalize=(v:unknown)=>String(v||'').toLowerCase().replace(/[‘’ʻʼ'`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function salaryObservation(row:any,metadata:any=null){
 const min=Number(row.salary_min),max=Number(row.salary_max);if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<=0||max<min||max>2147483647)return null;
 const text=salaryNormalize([row.description_uz,row.description_ru].join(' '));
 let period=metadata?.salaryPeriod,currency=metadata?.salaryCurrency;
 if(!period){
  const candidates=[['month',/\b(oylik|oyiga|monthly|month)\b|месяц|ежемесяч/],['shift',/\b(smenaga|smena|shift)\b|смену|смена/],['hour',/\b(soatiga|soatbay|hourly)\b|за час|в час/],['service',/\b(ishbay|xizmat uchun|per service)\b|за услугу/]].filter(([,re])=>(re as RegExp).test(text));
  if(candidates.length!==1)return null;period=candidates[0][0];
  if(/\b(usd|dollar|eur|euro)\b|доллар|евро|\$/.test([row.description_uz,row.description_ru].join(' ')))return null;
  if(/\b(uzs|som|sum)\b|сум/.test(text))currency='UZS';
 }
 if(currency!=='UZS'||!['month','shift','hour','service'].includes(period))return null;
 const employer=row.employer_id||row.user_id||row.created_by;
 return {jobId:row.id,period,currency,min,max,company:employer?`account:${employer}`:salaryNormalize(row.company_name),role:salaryNormalize(row.title_uz||row.title_ru),experience:normalizeExperienceCode(row.experience)||'',workMode:getJobWorkMode(row),employment:String(row.employment_type||''),shiftHours:Number(metadata?.shiftHours)||null,scope:salaryNormalize(metadata?.salaryScope),analyzedAt:new Date().toISOString()};
}
export function salaryAggregate(rows:any[]){
 const median=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[Math.floor(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2;};
 const byCompany=new Map<string,number[]>();for(const r of rows){if(!r?.company)continue;const v=byCompany.get(r.company)||[];v.push((r.min+r.max)/2);byCompany.set(r.company,v);}
 let values=Array.from(byCompany.values()).map(median).sort((a,b)=>a-b);if(values.length<5)return null;
 const q=(a:number[],p:number)=>{const n=(a.length-1)*p,lo=Math.floor(n);return a[lo]+(a[Math.ceil(n)]-a[lo])*(n-lo);};
 const lo=q(values,.25),hi=q(values,.75),iqr=hi-lo;values=values.filter(v=>iqr?v>=lo-iqr*1.5&&v<=hi+iqr*1.5:v===lo);if(values.length<5)return null;
 const center=Math.round(median(values));return {median:center,low:Math.round(q(values,.25)),high:Math.round(q(values,.75)),recommended:Math.round(center*1.1),count:values.length,upliftPercent:10,windowDays:90};
}
export const salaryKey=(row:any,metadata:any)=>miniHash({salaryVersion:1,row,metadata});
