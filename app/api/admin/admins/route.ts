import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {createManagedAdmin,listManagedAdmins} from '@/lib/admin-management';
export async function GET(request:NextRequest){try{
 const {client,profile}=await requireAdmin(request,true),params=request.nextUrl.searchParams;
 return accountResult(await listManagedAdmins(client,profile,Number(params.get('page')||'0'),params.get('state')||'all',params.get('search')?.trim()||''));
}catch(error){return accountFailure(error);}}
export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const {client,profile}=await requireAdmin(request,true);
 return accountResult({profile:await createManagedAdmin(client,profile,await request.json().catch(()=>null))},201);
}catch(error){return accountFailure(error);}}
