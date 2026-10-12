import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin,requireAccount} from '@/lib/auth/account';
import {ownVacancy,updateVacancy,vacancyEmployer,vacancyResult} from '@/lib/account-vacancies';
type Context={params:Promise<{id:string}>};
export async function GET(request:NextRequest,context:Context) {
 try {const {client,user}=await requireAccount(request),employer=await vacancyEmployer(client,user.id);return accountResult({vacancy:vacancyResult(await ownVacancy(client,user.id,employer.id,(await context.params).id))});}
 catch(error){return accountFailure(error);}
}
async function save(request:NextRequest,context:Context,edit:boolean) {
 try {checkSameOrigin(request);const {client,user}=await requireAccount(request),employer=await vacancyEmployer(client,user.id);return accountResult({vacancy:await updateVacancy(client,user.id,employer,(await context.params).id,await request.json().catch(()=>null),edit)});}
 catch(error){return accountFailure(error);}
}
export const PUT=(request:NextRequest,context:Context)=>save(request,context,true);
export const PATCH=(request:NextRequest,context:Context)=>save(request,context,false);
