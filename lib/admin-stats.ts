export type AdminStatsGroup={id?:string|number|null;name_uz?:string|null;name_ru?:string|null;type?:string|null;count:number};
export type AdminStats={totalJobs:number;activeJobs:number;hiddenJobs:number;removedJobs:number;totalViews:number;totalApplications:number;jobsByCategory:AdminStatsGroup[];jobsByDistrict:AdminStatsGroup[];jobsByType:AdminStatsGroup[]};
export function adminStatsResult(row:any):AdminStats{
 const result:any={};
 for(const key of ['totalJobs','activeJobs','hiddenJobs','removedJobs','totalViews','totalApplications']){
  if(!Number.isSafeInteger(row?.[key])||row[key]<0)throw new Error('Admin count unavailable');result[key]=row[key];
 }
 for(const key of ['jobsByCategory','jobsByDistrict','jobsByType']){
  if(!Array.isArray(row[key]))throw new Error('Admin groups unavailable');
  result[key]=row[key].map((group:any)=>{
   if(!Number.isSafeInteger(group?.count)||group.count<0)throw new Error('Admin group count unavailable');
   if(key==='jobsByType')return {type:typeof group.type==='string'?group.type:null,count:group.count};
   return {id:typeof group.id==='string'||Number.isSafeInteger(group.id)?group.id:null,name_uz:typeof group.name_uz==='string'?group.name_uz:null,name_ru:typeof group.name_ru==='string'?group.name_ru:null,count:group.count};
  });
 }
 return result;
}
