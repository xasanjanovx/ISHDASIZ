import {NextRequest} from 'next/server';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
export async function GET(request:NextRequest){try{const {profile}=await requireAdmin(request);return accountResult({profile});}catch(error){return accountFailure(error);}}
