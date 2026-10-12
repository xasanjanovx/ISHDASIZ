import {NextRequest} from 'next/server';
import {accountFailure,checkSameOrigin,requireAccount} from '@/lib/auth/account';
import {vacancyEmployer} from '@/lib/account-vacancies';
import {vacancyAIResponse} from '@/lib/vacancy-ai-server';
export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const {client,user}=await requireAccount(request);await vacancyEmployer(client,user.id);
 return await vacancyAIResponse(request,()=>client.rpc('ishdasiz_reserve_vacancy_ai',{p_user_id:user.id,p_session_version:user.session_version||0}));
}catch(error){return accountFailure(error);}}
