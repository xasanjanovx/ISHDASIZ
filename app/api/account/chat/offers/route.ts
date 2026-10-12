import {NextRequest} from 'next/server';
import {accountFailure,accountResult,requireAccount} from '@/lib/auth/account';
import {requireChatRole} from '@/lib/account-chat';
import {ownVacancy,vacancyQuery} from '@/lib/account-vacancies';
export async function GET(request:NextRequest){
 try{
  const {client,user}=await requireAccount(request),profile=await requireChatRole(client,user.id,'employer');
  const before=request.nextUrl.searchParams.get('before'),cursor=before?await ownVacancy(client,user.id,profile.id,before):undefined;
  const result=await vacancyQuery(client,user.id,profile.id,'id,title_uz,title_ru,created_at','all',cursor)
   .eq('ishdasiz_job_available',true).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(26);
  if(result.error||!Array.isArray(result.data))throw new Error('Vacancies unavailable');
  const rows=(result.data as any[]).slice(0,25);
  return accountResult({jobs:rows.map(row=>({id:row.id,title_uz:row.title_uz,title_ru:row.title_ru})),nextCursor:result.data.length>25?rows.at(-1)?.id:null});
 }catch(error){return accountFailure(error);}
}
