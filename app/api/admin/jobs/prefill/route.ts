import {NextRequest} from 'next/server';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {adminVacancyPrefill} from '@/lib/admin-vacancies';
export async function GET(request:NextRequest){try{const {client,profile}=await requireAdmin(request);return accountResult({employer:await adminVacancyPrefill(client,profile)});}catch(error){return accountFailure(error);}}
