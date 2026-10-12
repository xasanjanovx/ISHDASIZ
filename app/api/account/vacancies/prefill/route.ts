import {NextRequest} from 'next/server';
import {accountFailure,accountResult,requireAccount} from '@/lib/auth/account';
import {vacancyEmployer} from '@/lib/account-vacancies';
export async function GET(request:NextRequest) {
 try {const {client,user}=await requireAccount(request),employer=await vacancyEmployer(client,user.id);return accountResult({employer:{company_name:employer.company_name,contact_phone:employer.phone||user.phone,contact_telegram:employer.telegram,region_id:employer.region_id,district_id:employer.district_id,address:employer.address}});}
 catch(error){return accountFailure(error);}
}
