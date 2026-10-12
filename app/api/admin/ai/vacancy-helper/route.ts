import {NextRequest} from 'next/server';
import {accountFailure,checkSameOrigin} from '@/lib/auth/account';
import {adminDistrict,requireAdmin} from '@/lib/auth/admin';
import {vacancyAIResponse} from '@/lib/vacancy-ai-server';
export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const {client,profile}=await requireAdmin(request);adminDistrict(profile);
 return await vacancyAIResponse(request,()=>client.rpc('ishdasiz_reserve_admin_vacancy_ai',{p_admin_id:profile.id}));
}catch(error){return accountFailure(error);}}
