import {getJobWorkMode,parseWorkMode} from '@/lib/work-mode';
import {normalizeExperienceCode} from '@/lib/experience-compat';
import {salaryNormalize} from './salary';
const roles=[['sotuvchi','продавец','seller'],['buxgalter','бухгалтер','accountant'],['oshpaz','повар','cook'],['haydovchi','водитель','driver'],['tikuvchi','швея'],['oqituvchi','учитель','teacher']];
export function matchingRole(value:unknown){const s=salaryNormalize(value);return roles.find(group=>group.includes(s))?.[0]||s;}
export function matchingDistance(a:unknown,b:unknown){
 const valid=(v:any):v is [number,number]=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&Math.abs(v[0])<=90&&Math.abs(v[1])<=180;
 if(!valid(a)||!valid(b))return null;
 const rad=(v:number)=>v*Math.PI/180,x=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;
 return Math.round(6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)))*10)/10;
}
/** Profession and explicitly known work format are mandatory; other gaps are visible. */
export function miniMatch(job:any,resume:any,jobMeta:any={},resumeMeta:any={}){
 if(!matchingRole(job.title_uz||job.title_ru)||matchingRole(job.title_uz||job.title_ru)!==matchingRole(resume.title))return null;
 const mode=getJobWorkMode(job),preferred=parseWorkMode(resumeMeta.workMode)||(resume.employment_type==='remote'?'remote':null);
 if(!mode||!preferred||mode!==preferred)return null;
 const reasons=['Kasb mos','Ish shakli mos'],issues:string[]=[];
 if(jobMeta.days&&resumeMeta.days&&jobMeta.days!==resumeMeta.days&&jobMeta.days!=='Moslashuvchan'&&resumeMeta.days!=='Moslashuvchan')issues.push('Ish kunlari farq qiladi');
 const split=(v:unknown)=>String(v||'').split(',').map(s=>salaryNormalize(s)).filter(Boolean),requiredLanguages=split(jobMeta.languages),knownLanguages=split(resumeMeta.languages);
 if(requiredLanguages.length){if(requiredLanguages.every(l=>knownLanguages.includes(l)))reasons.push('Tillar mos');else issues.push('Talab qilingan tillarni aniqlashtiring');}
 if(job.education_level&&job.education_level!=='any'&&resume.education_level&&job.education_level!==resume.education_level)issues.push('Ma’lumot talabini aniqlashtiring');
 if(job.employment_type&&resume.employment_type&&job.employment_type!==resume.employment_type)issues.push('Bandlik turi farq qiladi');
 const required=normalizeExperienceCode(job.experience),actual=normalizeExperienceCode(resume.experience);
 if(required&&actual){if(Number(actual)<Number(required))issues.push('Tajriba talabidan kam');else reasons.push('Tajriba mos');}else issues.push('Tajribani aniqlashtiring');
 if(jobMeta.salaryPeriod&&resumeMeta.salaryPeriod&&jobMeta.salaryPeriod===resumeMeta.salaryPeriod&&jobMeta.salaryCurrency===resumeMeta.salaryCurrency
  &&(jobMeta.salaryPeriod!=='shift'||Number(jobMeta.shiftHours)>0&&Number(jobMeta.shiftHours)===Number(resumeMeta.shiftHours))
  &&(jobMeta.salaryPeriod!=='service'||salaryNormalize(jobMeta.salaryScope)!==''&&salaryNormalize(jobMeta.salaryScope)===salaryNormalize(resumeMeta.salaryScope))){
  const low=Number(job.salary_min),high=Number(job.salary_max),expected=Number(resume.expected_salary_min);
  if(high>0&&expected>0){if(high<expected)issues.push('Kutilgan to‘lov yuqoriroq');else reasons.push('To‘lov kutilmaga mos');}else if(low<=0)issues.push('To‘lovni kelishish kerak');
 }else issues.push('To‘lov davri yoki summasini aniqlashtiring');
 const distanceKm=matchingDistance([job.latitude,job.longitude],resumeMeta.coordinates);
 if(distanceKm!==null)reasons.push(`≈ ${distanceKm} km · to‘g‘ri chiziq`);
 else if(job.region_id===resume.region_id){reasons.push('Hudud mos');if(job.district_id!==resume.district_id)issues.push('Boshqa tuman');}
 else if(mode!=='remote')issues.push('Boshqa hudud');
 return {reasons,issues,distanceKm,exact:issues.length===0};
}
