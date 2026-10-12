export type StatsGroup={id:string|number|null;name_uz:string|null;name_ru:string|null;count:number};
export type DistrictStatsGroup=StatsGroup&{region_uz:string|null;region_ru:string|null};
export type PublicStats={availableJobs:number;views:number;applications:number;regionCount:number;byRegion:StatsGroup[];byCategory:StatsGroup[];byDistrict:DistrictStatsGroup[];byEmployment:Array<{type:string|null;count:number}>;asOf:string};
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const name=(value:unknown)=>typeof value==='string'?value.slice(0,200):null;
const employment=['full_time','part_time','contract','internship','remote'];
export function publicStats(value:any):PublicStats{
 const invalid=()=>{throw new Error('Public statistics unavailable');};
 if(!value||typeof value.asOf!=='string'||!Number.isFinite(Date.parse(value.asOf)))invalid();
 for(const key of ['availableJobs','views','applications','regionCount'])if(!count(value[key]))invalid();
 const result:any={availableJobs:value.availableJobs,views:value.views,applications:value.applications,regionCount:value.regionCount,asOf:value.asOf};
 for(const key of ['byRegion','byCategory','byDistrict','byEmployment']){
  if(!Array.isArray(value[key]))invalid();const ids=new Set<string>();let total=0;
  result[key]=value[key].map((row:any)=>{
   if(!row||!count(row.count)||row.count===0)invalid();total+=row.count;
   const id=key==='byEmployment'?row.type:row.id;
   if(id!==null&&(key==='byEmployment'?!employment.includes(id):key==='byCategory'?typeof id!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id):!Number.isSafeInteger(id)||id<1))invalid();
   if(ids.has(String(id)))invalid();ids.add(String(id));
   if(key==='byEmployment')return {type:id,count:row.count};
   const group={id,name_uz:name(row.name_uz),name_ru:name(row.name_ru),count:row.count};
   return key==='byDistrict'?{...group,region_uz:name(row.region_uz),region_ru:name(row.region_ru)}:group;
  });
  if(total!==value.availableJobs)invalid();
 }
 if(value.regionCount!==result.byRegion.filter((row:StatsGroup)=>row.id!==null).length)invalid();
 return result;
}
