import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {adminVacancy,updateAdminVacancy} from '@/lib/admin-vacancies';
import {vacancyResult} from '@/lib/account-vacancies';
type Context={params:Promise<{id:string}>};
export async function GET(request:NextRequest,{params}:Context){try{const {client,profile}=await requireAdmin(request),{id}=await params;return accountResult({vacancy:vacancyResult(await adminVacancy(client,profile,id))});}catch(error){return accountFailure(error);}}
async function update(request:NextRequest,{params}:Context,edit:boolean){try{checkSameOrigin(request);const {client,profile}=await requireAdmin(request),{id}=await params;return accountResult({vacancy:await updateAdminVacancy(client,profile,id,await request.json().catch(()=>null),edit)});}catch(error){return accountFailure(error);}}
export const PUT=(request:NextRequest,context:Context)=>update(request,context,true);
export const PATCH=(request:NextRequest,context:Context)=>update(request,context,false);
