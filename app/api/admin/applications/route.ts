import {NextRequest} from 'next/server';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {adminApplications,adminApplicationStats} from '@/lib/admin-applications';
export async function GET(request:NextRequest){try{
 const {client,profile}=await requireAdmin(request),params=request.nextUrl.searchParams;
 const options={page:Number(params.get('page')||'0'),status:params.get('status')||'all',job:params.get('job'),search:params.get('search')?.trim()||''};
 const page=await adminApplications(client,profile,options);const stats=await adminApplicationStats(client,profile).catch(()=>null);
 return accountResult({...page,stats,stats_error:!stats});
}catch(error){return accountFailure(error);}}
