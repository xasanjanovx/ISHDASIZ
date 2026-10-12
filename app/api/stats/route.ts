import {createClient} from '@supabase/supabase-js';
import {accountFailure,accountResult} from '@/lib/auth/account';
import {publicStats} from '@/lib/public-stats';
export const dynamic='force-dynamic';
export async function GET(){try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Public statistics unavailable');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await client.rpc('ishdasiz_public_statistics').abortSignal(AbortSignal.timeout(10000));
 if(result.error)throw new Error('Public statistics unavailable');
 return accountResult({stats:publicStats(result.data)});
}catch(error){return accountFailure(error);}}
