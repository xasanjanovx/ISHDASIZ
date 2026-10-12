import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchVacancyIdList,fetchVacancyDetail,fetchCompanyContacts,transformDetail} from '@/lib/scrapers/osonish';
import {osonishJob,type ImportReferences} from './osonish-job';
import {importProgress,type ImportProgress} from './progress';
import {AccountError,isUuid} from '@/lib/auth/account';

type Options={actorId?:string;runId?:string;requestId?:string;start?:boolean;maxPages?:number};
export class ImportWorkerError extends Error{constructor(public code:string){super('Import operation unavailable');}}
const WorkerError=ImportWorkerError;
async function rpc(client:SupabaseClient,name:string,args:Record<string,unknown>,signal:AbortSignal){
 const {data,error}=await client.rpc(name,args).abortSignal(signal);
 if(error)throw new WorkerError(error.code||'unavailable');return data;
}
async function references(client:SupabaseClient,signal:AbortSignal):Promise<ImportReferences>{
 async function rows(table:string,fields:string){const all:any[]=[];for(let start=0;;start+=500){const result=await client.from(table).select(fields).order('id',{ascending:true}).range(start,start+499).abortSignal(signal);if(result.error||!Array.isArray(result.data))throw new WorkerError('references');all.push(...result.data);if(result.data.length<500)return all;if(all.length>=10000)throw new WorkerError('references');}}
 const [regions,districts,categories]=await Promise.all([rows('regions','id,name_uz,name_ru,slug'),rows('districts','id,region_id,name_uz,name_ru'),rows('categories','id')]);
 const integer=(id:any)=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0;
 if(!regions.length||!districts.length||!categories.length||regions.some(r=>!integer(r.id)||typeof r.name_uz!=='string')||districts.some(d=>!integer(d.id)||!regions.some(r=>r.id===d.region_id)||typeof d.name_uz!=='string')||categories.some(c=>!isUuid(c.id)))throw new WorkerError('references');
 return {regions,districts,categories};
}
export async function readOsonishImport(client:SupabaseClient,actorId?:string):Promise<ImportProgress|null>{
 const data=await rpc(client,'ishdasiz_osonish_import_status',{p_actor_id:actorId??null},AbortSignal.timeout(8000));
 return data===null?null:importProgress(data);
}
export async function stepOsonishImport(client:SupabaseClient,options:Options={}):Promise<ImportProgress>{
 if(options.runId!==undefined&&!isUuid(options.runId)||options.start&&(!isUuid(options.requestId))||options.start&&options.runId!==undefined||options.maxPages!==undefined&&(!Number.isSafeInteger(options.maxPages)||options.maxPages<1||options.maxPages>500))throw new AccountError(400,'Проверьте параметры импорта / Import parametrlarini tekshiring');
 const claimed=await rpc(client,'ishdasiz_claim_osonish_refresh',{p_actor_id:options.actorId??null,p_run_id:options.runId??null,p_request_id:options.requestId??null,p_start:options.start??false,p_max_pages:options.maxPages??500},AbortSignal.timeout(8000));
 let progress=importProgress(claimed?.progress);const token=claimed?.token;
 if(token===null)return progress;
 if(!isUuid(token))throw new WorkerError('invalid_lease');
 const args={p_run_id:progress.id,p_token:token},controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000),signal=controller.signal;
 let errorCode:string|null=null,fatal=false,madeProgress=false;
 try{
  let refs:ImportReferences|undefined;
  for(let batch=0;batch<5&&!signal.aborted&&progress.state==='running';batch++){
   const work=await rpc(client,'ishdasiz_osonish_work',args,signal);progress=importProgress(work?.progress);
   const protocol=work?.protocol_version??1;
   if(protocol!==1&&protocol!==2)throw new WorkerError('invalid_data');
   if(protocol===2&&progress.phase==='verify'){
    progress=importProgress(await rpc(client,'ishdasiz_finish_osonish_refresh',args,signal));madeProgress=true;
   }else if(progress.phase==='list'||progress.phase==='verify'){
    const verify=progress.phase==='verify',page=verify?progress.verify_page:progress.next_page;
    let source;try{source=await fetchVacancyIdList(page,signal);}catch{if(signal.aborted)break;throw new WorkerError('source');}
    if(source.total===null||source.lastPage===null)throw new WorkerError('22023');
    progress=importProgress(await rpc(client,protocol===2?'ishdasiz_osonish_candidates':'ishdasiz_osonish_page',{...args,p_page:page,p_ids:source.ids.map(String),p_total:source.total,p_last_page:source.lastPage,...(protocol===1?{p_verify:verify}:{})},signal));
    madeProgress=true;
   }else if(progress.phase==='details'){
    if(!Array.isArray(work.ids)||work.ids.length>50||new Set(work.ids).size!==work.ids.length||work.ids.some((id:any)=>typeof id!=='string'||!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))))throw new WorkerError('invalid_data');
    if(!work.ids.length)break;
    const resolvedRefs=refs??=await references(client,signal);
    // Fetch five at a time within one shared deadline, then commit each result
    // with its checkpoint. A crashed request repeats only unconfirmed items.
    for(let offset=0;offset<work.ids.length&&!signal.aborted&&progress.state==='running';offset+=5){
     const group=work.ids.slice(offset,offset+5) as string[];
     const outcomes=await Promise.allSettled(group.map(async id=>{
      const detail=await fetchVacancyDetail(Number(id),signal);
     let state:'active'|'filled'|'removed',payload:any=null;
     if(!detail.success&&detail.status!==404)return {id,state:'retry',payload:null};
     if(detail.status===404)state='removed';else if(detail.detail?.status!==2)state='filled';else{
      state='active';const vacancy=transformDetail(detail.detail);
      if(!vacancy.has_contact&&detail.detail.company?.id){const contacts=await fetchCompanyContacts(detail.detail.company.id,signal);if(contacts){if(typeof contacts.phone==='string'&&/^\+?[\d\s().-]+$/.test(contacts.phone)){let digits=contacts.phone.replace(/\D/g,'');if(digits.length===9)digits='998'+digits;if(/^998\d{9}$/.test(digits))vacancy.contact_phone='+'+digits;}if(contacts.email)vacancy.contact_email=contacts.email;}}
      payload=osonishJob(vacancy,resolvedRefs);
     }
      return {id,state,payload};
     }));
     for(let index=0;index<outcomes.length&&!signal.aborted&&progress.state==='running';index++){
      const outcome=outcomes[index];
      if(outcome.status==='rejected')throw new WorkerError('source');
      const {id,state,payload}=outcome.value;
      progress=importProgress(await rpc(client,protocol===2?'ishdasiz_osonish_refresh_item':'ishdasiz_osonish_item',{...args,p_source_id:id,p_state:state,p_payload:payload},signal));
      madeProgress=true;
     }
    }
    break;
   }else break;
  }
 }catch(error){
  if(!signal.aborted){const code=error instanceof WorkerError?error.code:'invalid_data';
   errorCode=code==='42501'?'permission_changed':['22023','23505'].includes(code)?'snapshot_changed':code==='source'?'source_unavailable':code==='invalid_data'?'invalid_data':'write_failed';
   fatal=['permission_changed','snapshot_changed','invalid_data'].includes(errorCode);
  }
 }finally{clearTimeout(timeout);}
 if(signal.aborted&&!madeProgress)errorCode='request_timeout';
 // Releasing a worker uses a separate short deadline. If the response was lost
 // or the process died, a later request takes over the same run after 90 seconds.
 try{progress=importProgress(await rpc(client,'ishdasiz_yield_osonish_import',{...args,p_error:errorCode,p_fatal:fatal},AbortSignal.timeout(5000)));}
 catch{throw new WorkerError('release');}
 return progress;
}
