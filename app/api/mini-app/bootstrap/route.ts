import {accountFailure,accountResult} from '@/lib/auth/account';
import {getAuthClient} from '@/lib/auth/server';
import {publicStats} from '@/lib/public-stats';
export const dynamic='force-dynamic';
export async function GET(){try{
 const client=getAuthClient();
 const [regions,districts,categories,stats,resumes,storage]=await Promise.all([
  client.from('regions').select('id,name_uz,name_ru,slug').order('name_uz'),
  client.from('districts').select('id,region_id,name_uz,name_ru').order('name_uz'),
  client.from('categories').select('id,name_uz,name_ru').order('name_uz'),
  client.rpc('ishdasiz_public_statistics'),
  client.from('resumes').select('id',{count:'exact',head:true}).eq('ishdasiz_resume_available',true),
  client.from('mini_app_records').select('id').limit(0),
 ]);
 if(regions.error||districts.error||categories.error||stats.error||resumes.error||resumes.count==null)throw Error('Catalog unavailable');
 return accountResult({regions:regions.data,districts:districts.data,categories:categories.data,stats:publicStats(stats.data),resumeCount:resumes.count,storageReady:!storage.error});
}catch(e){return accountFailure(e);}}
