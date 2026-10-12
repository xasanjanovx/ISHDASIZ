import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult} from '@/lib/auth/account';
import {adminDistrict,requireAdmin} from '@/lib/auth/admin';
import {adminStatsResult} from '@/lib/admin-stats';
export async function GET(request:NextRequest){try{
 const {client,profile}=await requireAdmin(request);adminDistrict(profile);
 const result=await client.rpc('ishdasiz_admin_stats',{p_admin_id:profile.id});
 if(result.error?.code==='42501')throw new AccountError(403,'Права изменились. Обновите доступ / Huquqlar o‘zgardi. Kirishni yangilang');
 if(result.error)throw result.error;
 return accountResult({stats:adminStatsResult(result.data)});
}catch(error){return accountFailure(error);}}
