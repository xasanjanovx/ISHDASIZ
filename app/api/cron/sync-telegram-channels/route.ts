import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callTelegramAPI, editMessage, sendChannelMessage } from '@/lib/telegram/telegram-api';
import { ChannelDeliveryNeedsReview, reconcileChannelEntity } from '@/lib/telegram/channel-worker';
import { verifyCron } from '@/lib/auth/cron';
import { resumeUuid } from '@/lib/telegram/owned-resumes';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request: NextRequest) {
 if(!verifyCron(request))return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
 if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  return NextResponse.json({success:false,error:'Channel worker is not configured'},{status:503});
 if(process.env.TELEGRAM_DRY_RUN==='1')return NextResponse.json({success:false,error:'Dry run cannot acknowledge channel deliveries'},{status:409});
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=randomUUID();let acquired=false;
 const lease=async(action:'acquire'|'renew'|'release')=>{const result=await client.rpc('ishdasiz_channel_lease',{p_token:token,p_action:action}).abortSignal(AbortSignal.timeout(15000));if(result.error||typeof result.data!=='boolean')throw new Error('Channel lease unavailable');return result.data;};
 const guard=async()=>{if(!await lease('renew'))throw new Error('Channel lease expired');};
 const finish=async(id:string,success:boolean,error:string|null=null)=>{const result=await client.rpc('ishdasiz_channel_finish',{p_token:token,p_event:id,p_success:success,p_error:error}).abortSignal(AbortSignal.timeout(15000));if(result.error||result.data!==true)throw new Error('Channel result unconfirmed');};
 try{
  acquired=await lease('acquire');
  if(!acquired)return NextResponse.json({success:true,worker:'telegram_channel_sync',running:true});
  const summary={processed:0,done:0,failed:0,needsReview:0,sent:0,edited:0,deleted:0,redacted:0,skipped:0};
  const deadline=Date.now()+230000;
  while(summary.processed<40&&Date.now()<deadline){
   await guard();const claimed=await client.rpc('ishdasiz_channel_claim',{p_token:token}).abortSignal(AbortSignal.timeout(15000));
   if(claimed.error)throw new Error('Channel queue unavailable');
   if(claimed.data===null)break;
   const event=claimed.data;
   if(!resumeUuid(event?.id)||!resumeUuid(event.entity_id)||!['job','resume'].includes(event.entity_type)||event.status!=='processing'||event.lease_token!==token||!Number.isInteger(event.attempts)||event.attempts<1||event.attempts>8)throw new Error('Invalid channel claim');
   summary.processed++;
   try{
    const result=await reconcileChannelEntity(client,event,{call:(method,params)=>callTelegramAPI(method,params,{suppressErrors:true}),send:sendChannelMessage,edit:editMessage},guard);
    await finish(event.id,true);summary.done++;
    for(const key of ['sent','edited','deleted','redacted','skipped'] as const)summary[key]+=result[key];
   }catch(error){
    const review=error instanceof ChannelDeliveryNeedsReview;
    await finish(event.id,false,review?'Channel delivery needs operator review; automatic send blocked':'Channel synchronization failed; inspect queue and Telegram permissions');summary.failed++;
    if(review)summary.needsReview++;
   }
  }
  const attention=await client.rpc('ishdasiz_channel_delivery_attention').abortSignal(AbortSignal.timeout(15000));
  if(attention.error||!Number.isSafeInteger(attention.data)||attention.data<0)throw new Error('Channel delivery state unavailable');
  const success=summary.failed===0&&attention.data===0;
  return NextResponse.json({success,worker:'telegram_channel_sync',...summary,outstandingReview:attention.data},{status:success?200:503});
 }catch{
  return NextResponse.json({success:false,error:'Channel synchronization unavailable'},{status:503});
 }finally{
  if(acquired){try{await lease('release');}catch{console.error('Channel lease release unavailable');}}
 }
}
export async function POST(request: NextRequest){return GET(request);}
