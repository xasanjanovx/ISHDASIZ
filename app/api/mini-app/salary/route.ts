import {NextRequest} from 'next/server';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {getAuthClient} from '@/lib/auth/server';
import {salaryAggregate,salaryKey,salaryNormalize,salaryObservation} from '@/lib/mini-app/salary';
export async function GET(request:NextRequest){try{
 const p=request.nextUrl.searchParams,title=(p.get('position')||'').slice(0,160),region=Number(p.get('region')),period=p.get('period')||'month';
 if(title.length<3||!Number.isSafeInteger(region)||region<1||!['month','shift','hour','service'].includes(period))return accountResult({estimate:null});
 const client=getAuthClient();let query=client.from('jobs').select('id,title_uz,title_ru,description_uz,description_ru,company_name,employer_id,user_id,created_by,salary_min,salary_max,experience,work_mode,employment_type,created_at').eq('ishdasiz_job_available',true).eq('region_id',region).gte('created_at',new Date(Date.now()-90*86400000).toISOString());
 const needle=title.replace(/[,().%_*"\\]/g,' ').trim();query=query.or(`title_uz.ilike.%${needle}%,title_ru.ilike.%${needle}%`);
 const rows=await query.order('created_at',{ascending:false}).limit(300).abortSignal(AbortSignal.timeout(12000));if(rows.error)throw rows.error;
 if(!rows.data?.length)return accountResult({estimate:null});
 const meta=await client.from('mini_app_records').select('id,metadata').eq('kind','vacancy').in('id',rows.data.map(r=>r.id));if(meta.error)return accountResult({estimate:null});
 const all:any[]=[];
 for(let offset=0;offset<rows.data.length;offset+=40){
  const chunk=rows.data.slice(offset,offset+40).map(row=>({row,metadata:meta.data.find(m=>m.id===row.id)?.metadata||null}));
  const keys=chunk.map(r=>salaryKey(r.row,r.metadata));const cache=await client.from('mini_app_analysis').select('cache_key,result').in('cache_key',keys).gt('expires_at',new Date().toISOString());if(cache.error)return accountResult({estimate:null});
  const updates:any[]=[];chunk.forEach((r,i)=>{const old=cache.data?.find(c=>c.cache_key===keys[i]);const observation=old?old.result:salaryObservation(r.row,r.metadata);if(!old)updates.push({cache_key:keys[i],result:observation||{insufficient:true},expires_at:new Date(Date.now()+86400000).toISOString()});if(observation&&!observation.insufficient)all.push(observation);});
  if(updates.length){const saved=await client.from('mini_app_analysis').upsert(updates);if(saved.error)throw saved.error;}
 }
 const matching=all.filter(r=>r.period===period&&r.currency==='UZS'&&r.role===salaryNormalize(title)&&r.workMode===p.get('workMode')&&r.employment===p.get('employment')&&r.experience===p.get('experience')&&(period!=='shift'||r.shiftHours===Number(p.get('shiftHours')))&&(period!=='service'||r.scope===salaryNormalize(p.get('scope'))));
 return accountResult({estimate:salaryAggregate(matching),asOf:new Date().toISOString(),source:'published_offers'});
}catch(e){return accountFailure(e);}}
