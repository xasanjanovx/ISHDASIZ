import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,isUuid,requireAccount} from '@/lib/auth/account';
import {requireChatRole} from '@/lib/account-chat';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {client,user}=await requireAccount(request);await requireChatRole(client,user.id,'job_seeker');const {id}=await params;if(!isUuid(id))throw new AccountError(404,'Вакансия недоступна / Vakansiya mavjud emas');
 const [favorite,application]=await Promise.all([client.from('favorites').select('id').eq('user_id',user.id).eq('job_id',id).maybeSingle(),client.from('job_applications').select('id').eq('user_id',user.id).eq('job_id',id).limit(1).maybeSingle()]);
 if(favorite.error||application.error)throw new Error('Personal job state unavailable');return accountResult({favorite:!!favorite.data,applied:!!application.data});
 }catch(error){return accountFailure(error);}
}
