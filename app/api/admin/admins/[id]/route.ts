import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {updateManagedAdmin} from '@/lib/admin-management';
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 checkSameOrigin(request);const {client,profile}=await requireAdmin(request,true);
 return accountResult({profile:await updateManagedAdmin(client,profile,(await params).id,await request.json().catch(()=>null))});
}catch(error){return accountFailure(error);}}
