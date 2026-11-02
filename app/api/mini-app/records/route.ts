import {NextRequest} from 'next/server';
import {ZodError} from 'zod';
import {AccountError,accountFailure,accountResult,checkSameOrigin,requireAccount} from '@/lib/auth/account';
import {ensureProfile} from '@/lib/auth/server';
import {miniRecordSchema,miniValidate,miniNative} from '@/lib/mini-app/contracts';
import {vacancyEmployer,vacancyInput} from '@/lib/account-vacancies';
import {resumeInput,resumeStoragePayload} from '@/lib/account-resumes';
import {miniModerate} from '@/lib/mini-app/ai';
import {employerJobScope} from '@/lib/account-jobs';
export const maxDuration=60;
export async function GET(request:NextRequest){try{
 const {client,user}=await requireAccount(request);
 const employer=await client.from('employer_profiles').select('id').eq('user_id',user.id).maybeSingle();if(employer.error)throw employer.error;
 const probe=await client.from('resumes').select('views').limit(0);
 if(probe.error&&probe.error.code!=='42703')throw probe.error;
 const viewField=probe.error?'views_count':'views';
 const scope=employer.data?employerJobScope(user.id,employer.data.id):`and(employer_id.is.null,or(user_id.eq.${user.id},and(user_id.is.null,created_by.eq.${user.id})))`;
 const [jobs,resumes,entries]=await Promise.all([
  client.from('jobs').select('id,title_uz,title_ru,company_name,description_uz,description_ru,contact_telegram,work_mode,employment_type,experience,latitude,longitude,address,status,created_at,updated_at,region_id,district_id,salary_min,salary_max,contact_phone,views_count,regions(name_uz),districts(name_uz)',{count:'exact'}).or(`and(or(${scope}),or(status.is.null,status.neq.archived))`).order('created_at',{ascending:false}).limit(100),
  client.from('resumes').select(`id,title,full_name,phone,about,skills,status,created_at,updated_at,region_id,district_id,expected_salary_min,expected_salary_max,${viewField},regions(name_uz),districts(name_uz)`,{count:'exact'}).eq('user_id',user.id).or('status.is.null,status.neq.archived').order('created_at',{ascending:false}).limit(100),
  client.from('mini_app_records').select('id,kind,metadata').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200),
 ]);
 if(jobs.error||resumes.error)throw Error('Own records unavailable');
 return accountResult({jobs:jobs.data,resumes:resumes.data,entries:entries.error?[]:entries.data,counts:{jobs:jobs.count,resumes:resumes.count}});
}catch(e){return accountFailure(e);}}
export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const {client,user}=await requireAccount(request);const raw=await request.text();if(raw.length>50000)throw new AccountError(413,'E’lon matni juda uzun');
 const parsed=miniRecordSchema.parse(JSON.parse(raw)),{id,kind,form}=parsed;miniValidate(kind,form);
 const probe=await client.from('mini_app_records').select('id').limit(0);if(probe.error)throw new AccountError(503,'Saqlash xizmati vaqtincha mavjud emas. Qoralamangiz saqlandi.');
 if(!form.categoryId){const other=await client.from('categories').select('id').ilike('name_uz','%boshqa%').limit(1).maybeSingle();if(other.error||!other.data)throw new AccountError(400,'Lavozimni qidiruv ro‘yxatidan tanlang');form.categoryId=other.data.id;}
 const source=[form.position,form.company,form.name,form.hr,form.description,form.duties,form.requirements,form.benefits,form.benefitDetails,form.about,form.skills,form.address,form.landmark,form.hours,form.salaryScope].filter(Boolean).join('\n');
 await miniModerate(client,user.id,source);
 await ensureProfile(client,user,kind==='vacancy'?'employer':'job_seeker');
 const native=miniNative(kind,form);let payload;
 if(kind==='vacancy'){const employer=await vacancyEmployer(client,user.id);payload={...await vacancyInput(client,native,{...employer,company_name:form.company}),hr_name:form.hr};}
 else payload=await resumeStoragePayload(client,await resumeInput(client,native));
 const saved=await client.rpc('ishdasiz_mini_app_save',{p_user:user.id,p_version:user.session_version||0,p_id:id,p_kind:kind,p_payload:payload,p_metadata:form});
 if(saved.error?.code==='42501')throw new AccountError(401,'Qayta kiring. Qoralama saqlandi.');
 if(saved.error?.code==='23505')throw new AccountError(409,'Bu e’lon allaqachon saqlangan. E’lonlarimni oching.');
 if(saved.error)throw saved.error;return accountResult({record:{...saved.data,form},saved:true},201);
}catch(e){return accountFailure(e instanceof ZodError||e instanceof SyntaxError?new AccountError(400,'Maydonlarni tekshiring'):e);}}
