import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,checkSameOrigin,isUuid,requireAccount} from '@/lib/auth/account';
const plans=[{days:1,price:59000},{days:2,price:89000},{days:3,price:119000},{days:7,price:209000,pin:true},{days:30,price:359000,pin:true}];
export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const {client,user}=await requireAccount(request),body=await request.json().catch(()=>null);if(!isUuid(body?.id))throw new AccountError(400,'Vakansiyani tanlang');
 const result=await client.rpc('ishdasiz_mini_app_channel',{p_user:user.id,p_version:user.session_version||0,p_job:body.id});
 if(result.error?.code==='42501')throw new AccountError(403,'Bu vakansiya mavjud emas yoki sizga tegishli emas');if(result.error)throw result.error;
 return accountResult({...result.data,...(result.data?.status==='payment_required'?{plans,paymentReady:false}:{})},result.data?.status==='payment_required'?402:200);
}catch(e){return accountFailure(e);}}
