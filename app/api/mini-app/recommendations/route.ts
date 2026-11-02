import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,isUuid,requireAccount} from '@/lib/auth/account';
import {miniMatch} from '@/lib/mini-app/matching';
export async function GET(request:NextRequest){try{
 const {client,user}=await requireAccount(request),id=request.nextUrl.searchParams.get('id');
 if(!isUuid(id))throw new AccountError(400,'Rezyumeni tanlang');
 const [resume,meta]=await Promise.all([
  client.from('resumes').select('id,title,region_id,district_id,experience,employment_type,expected_salary_min,expected_salary_max').eq('id',id).eq('user_id',user.id).eq('ishdasiz_resume_available',true).maybeSingle(),
  client.from('mini_app_records').select('metadata').eq('id',id).eq('user_id',user.id).eq('kind','resume').maybeSingle(),
 ]);
 if(resume.error||meta.error)throw Error('Recommendations unavailable');
 if(!resume.data||!meta.data)throw new AccountError(404,'Faol rezyume topilmadi');
 const resumeMetadata=meta.data.metadata;
 const needle=resume.data.title.replace(/[,().%_*"\\]/g,' ').slice(0,160).trim();
 if(needle.length<3)return accountResult({matches:[]});
 const jobs=await client.from('jobs').select('id,title_uz,title_ru,company_name,region_id,district_id,salary_min,salary_max,work_mode,employment_type,experience,latitude,longitude,regions(name_uz),districts(name_uz)')
  .eq('ishdasiz_job_available',true).or(`title_uz.ilike.%${needle}%,title_ru.ilike.%${needle}%`).order('created_at',{ascending:false}).limit(200).abortSignal(AbortSignal.timeout(12000));
 if(jobs.error)throw jobs.error;if(!jobs.data.length)return accountResult({matches:[]});
 const metadata=await client.from('mini_app_records').select('id,metadata').eq('kind','vacancy').in('id',jobs.data.map(j=>j.id));if(metadata.error)throw metadata.error;
 const matches=jobs.data.flatMap(job=>{const m=metadata.data.find(r=>r.id===job.id)?.metadata||{},match=miniMatch(job,resume.data,m,resumeMetadata);return match?[{job:{...job,compensation:{salaryPeriod:m.salaryPeriod,salaryCurrency:m.salaryCurrency,shiftHours:m.shiftHours,salaryScope:m.salaryScope}},...match}]:[];})
 .sort((a,b)=>Number(b.exact)-Number(a.exact)||(a.distanceKm??Infinity)-(b.distanceKm??Infinity));
 return accountResult({matches:matches.slice(0,50),hasMore:matches.length>50});
}catch(e){return accountFailure(e);}}
