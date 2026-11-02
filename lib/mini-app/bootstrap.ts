import {unstable_cache} from 'next/cache';
import {getAuthClient} from '@/lib/auth/server';
import {publicStats} from '@/lib/public-stats';

// Public reference names and aggregate counts only. Never put account records,
// contacts, sessions or candidate permissions in this shared cache.
const cachedBootstrap=unstable_cache(async()=>{
 const client=getAuthClient(),signal=AbortSignal.timeout(8000);
 const [regions,districts,categories,stats,resumes,storage]=await Promise.all([
  client.from('regions').select('id,name_uz,name_ru,slug').order('name_uz').abortSignal(signal),
  client.from('districts').select('id,region_id,name_uz,name_ru').order('name_uz').abortSignal(signal),
  client.from('categories').select('id,name_uz,name_ru').order('name_uz').abortSignal(signal),
  client.rpc('ishdasiz_public_statistics').abortSignal(signal),
  client.from('resumes').select('id',{count:'exact',head:true}).eq('ishdasiz_resume_available',true).abortSignal(signal),
  client.from('mini_app_records').select('id').limit(0).abortSignal(signal),
 ]);
 if(regions.error||districts.error||categories.error||stats.error||resumes.error||resumes.count==null)throw Error('Catalog unavailable');
 return {regions:regions.data,districts:districts.data,categories:categories.data,stats:publicStats(stats.data),resumeCount:resumes.count,storageReady:!storage.error};
},['mini-app-public-bootstrap-v1',process.env.NEXT_PUBLIC_SUPABASE_URL||''],{revalidate:30});

let pending:ReturnType<typeof cachedBootstrap>|null=null;
export function miniPublicBootstrap(){
 // Coalesce a burst of callers even on a cold cache. Errors are not retained.
 if(!pending)pending=cachedBootstrap().finally(()=>{pending=null;});
 return pending;
}
