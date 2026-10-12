import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {adminVacancy,adminVacancyQuery,createAdminVacancy} from '@/lib/admin-vacancies';
import {VACANCY_EDIT_FIELDS,vacancyResult,vacancyApplicationCounts} from '@/lib/account-vacancies';
export async function GET(request:NextRequest){try{
 const {client,profile}=await requireAdmin(request),state=request.nextUrl.searchParams.get('state')||'all',before=request.nextUrl.searchParams.get('before');
 const cursor=before?await adminVacancy(client,profile,before):undefined;
 const result=await adminVacancyQuery(client,profile,`${VACANCY_EDIT_FIELDS},source_status,is_imported,categories(name_uz,name_ru),regions(name_uz,name_ru),districts(name_uz,name_ru)`,state,cursor).order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(51);
 if(result.error)throw result.error;const rows=((result.data||[]) as any[]).slice(0,50);
 const [counts,stats]=await Promise.allSettled([vacancyApplicationCounts(client,rows.map(row=>row.id)),Promise.all(['all','active','draft','filled','archived'].map(async state=>{const r=await adminVacancyQuery(client,profile,'id',state,undefined,true);if(r.error||r.count==null)throw new Error('Count unavailable');return [state,r.count];}))]);
 return accountResult({vacancies:rows.map(row=>({...vacancyResult(row),categories:row.categories,regions:row.regions,districts:row.districts,source_status:row.source_status,is_imported:row.is_imported,applications_count:counts.status==='fulfilled'?counts.value[row.id]:null})),nextCursor:(result.data?.length||0)>50?rows.at(-1)?.id:null,stats:stats.status==='fulfilled'?Object.fromEntries(stats.value):null,counts_error:counts.status==='rejected',stats_error:stats.status==='rejected'});
}catch(error){return accountFailure(error);}}
export async function POST(request:NextRequest){try{checkSameOrigin(request);const {client,profile}=await requireAdmin(request);return accountResult({vacancy:await createAdminVacancy(client,profile,await request.json().catch(()=>null))},201);}catch(error){return accountFailure(error);}}
