export type JobWorkMode = 'onsite' | 'home' | 'remote' | 'hybrid';

function normalized(value:unknown):string {
 return typeof value==='string'||typeof value==='number'
  ?String(value).trim().toLowerCase().replace(/ё/g,'е').replace(/[‘’ʻʼ`']/g,'').replace(/[-_]/g,' ').replace(/\s+/g,' ')
  :'';
}
const modes:Record<JobWorkMode,string[]>={
 onsite:['1','onsite','on site','office','in office','на месте','в офисе','офис','ish joyida'],
 home:['2','home','work from home','working from home','работа из дома','uydan ishlash'],
 remote:['3','remote','remote work','fully remote','remotely','masofaviy','masofadan','masofadan ishlash',
  'удаленная','удаленный','удаленно','удаленная работа','дистанционная','дистанционно'],
 hybrid:['4','hybrid','gibrid','гибрид','гибридный','гибридная','гибрид (офис + удаленно)','gibrid (ish joyi + masofaviy)'],
};
export function parseWorkMode(value:unknown):JobWorkMode|null {
 const text=normalized(value);
 for(const key of Object.keys(modes) as JobWorkMode[])if(modes[key].includes(text))return key;
 return null;
}
export function hasExplicitWorkMode(value:unknown):boolean {
 const text=normalized(value);
 return text!==''&&!['0','all','any','ahamiyatsiz','ahamiyatga ega emas','не важно'].includes(text);
}
export function getJobWorkMode(job:Record<string,any>|null|undefined):JobWorkMode|null {
 if(!job)return null;
 const raw=job.raw_source_json??{};
 // OsonIsh work_type codes differ from our older work_mode codes (2 = shifts).
 // Preserve the source format even for imports saved by the previous mapper.
 if(typeof raw.work_type==='number'){
  const sourceModes:Record<number,JobWorkMode>={1:'onsite',2:'onsite',3:'remote',4:'hybrid',5:'home',6:'onsite'};
  return sourceModes[raw.work_type]??null;
 }
 for(const value of [job.work_mode,job.work_format,raw.work_mode,raw.work_format,raw.workplace_type]){
  if(!hasExplicitWorkMode(value))continue;
  // An explicit format takes precedence over older, lower-priority fields.
  return parseWorkMode(value);
 }
 return normalized(job.employment_type)==='remote'?'remote':null;
}
export function isRemoteJob(job:Record<string,any>|null|undefined):boolean {
 return getJobWorkMode(job)==='remote';
}
