import {unstable_cache} from 'next/cache';
import {getAuthClient} from './auth/server';
import {jobMapQuery} from './job-map-query';

const cachedTotal=unstable_cache(async()=>{
 const result=await jobMapQuery(getAuthClient(),0,50,{count:'only'}).abortSignal(AbortSignal.timeout(8000));
 if(result.error||!Number.isSafeInteger(result.count)||result.count!<0)throw Error('Map count unavailable');
 return result.count!;
},['public-map-total-v1',process.env.NEXT_PUBLIC_SUPABASE_URL||''],{revalidate:30});
let pending:Promise<number>|null=null;
export function publicMapTotal(){if(!pending)pending=cachedTotal().finally(()=>{pending=null;});return pending;}
