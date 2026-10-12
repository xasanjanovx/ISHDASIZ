import type { SupabaseClient } from '@supabase/supabase-js';
import { readChannelSnapshot, removeChannelMessage } from './channel-state';
import { buildJobChannelMessage, buildResumeChannelMessage, getChannelByRegionSlug, hashMessage } from './channel-sync';
import { resumeUuid } from './owned-resumes';

type Event = { id: string; lease_token: string; entity_type: 'job'|'resume'; entity_id: string };
type Transport = { call: (method: string, params: Record<string, any>) => Promise<any>; send: (channel: string, text: string, options: any) => Promise<any>; edit: (channel: string, id: number, text: string, options: any) => Promise<any> };
export class ChannelDeliveryNeedsReview extends Error {
  constructor(){super('Channel delivery needs operator review');this.name='ChannelDeliveryNeedsReview';}
}
export async function reconcileChannelEntity(client: SupabaseClient, event: Event, telegram: Transport, guard: () => Promise<void>) {
  if (!['job','resume'].includes(event.entity_type) || !resumeUuid(event.entity_id) || !resumeUuid(event.id) || !resumeUuid(event.lease_token)) throw new Error('Invalid channel event');
  const summary={sent:0,edited:0,deleted:0,redacted:0,skipped:0};
  const snapshot=await readChannelSnapshot(client,event.entity_type,event.entity_id);
  const records:any[]=[],seen=new Set<string>();let after:string|null=null;
  for(;;){
    let query=client.from('channel_delivery_receipts').select('id,channel_username,message_id,message_hash,status').eq('entity_type',event.entity_type).eq('entity_id',event.entity_id).eq('status','active').order('id',{ascending:true}).limit(500);
    if(after)query=query.gt('id',after);
    const loaded=await query.abortSignal(AbortSignal.timeout(15000));
    if(loaded.error||!Array.isArray(loaded.data)||loaded.data.length>500)throw new Error('Channel posts unavailable');
    for(const post of loaded.data){if(!resumeUuid(post.id)||seen.has(post.id)||after!==null&&post.id<=after||!['active','deleted','redacted'].includes(post.status)||!Number.isSafeInteger(Number(post.message_id))||Number(post.message_id)<1)throw new Error('Channel post page changed');seen.add(post.id);records.push(post);after=post.id;}
    if(loaded.data.length<500)break;
  }
  const posts=records.filter(post=>post.status==='active');
  const channel=snapshot.available?getChannelByRegionSlug(snapshot.region_slug):null;
  const update=async(post:any,status:'active'|'deleted'|'redacted',hash:string|null=null,current:any=null)=>{
    await guard();
    const saved=await client.rpc('ishdasiz_channel_receipt_update',{p_token:event.lease_token,p_event:event.id,p_receipt:post.id,p_status:status,p_hash:hash,p_snapshot:current}).abortSignal(AbortSignal.timeout(15000));
    if(saved.error||saved.data!==true)throw new Error('Channel receipt not recorded');
  };
  const remove=async(post:any)=>{
    await guard();const status=await removeChannelMessage(telegram.call,post.channel_username,Number(post.message_id));
    await update(post,status);summary[status]++;
  };
  for(const post of posts)if(!channel||post.channel_username!==channel)await remove(post);
  if(!channel){summary.skipped=1;return summary;}
  const message=event.entity_type==='job'?buildJobChannelMessage(snapshot.entity,snapshot.region_slug):buildResumeChannelMessage(snapshot.entity,snapshot.region_slug);
  const hash=hashMessage(message),candidates=posts.filter(post=>post.channel_username===channel);
  const target=candidates.find(post=>post.message_hash===hash)||candidates[0];
  for(const duplicate of candidates)if(duplicate!==target)await remove(duplicate);
  // Recheck publication after database/network work, before a send or edit.
  const latest=await readChannelSnapshot(client,event.entity_type,event.entity_id);
  if(!latest.available||latest.region_slug!==snapshot.region_slug)throw new Error('Channel publication changed');
  const latestMessage=event.entity_type==='job'?buildJobChannelMessage(latest.entity,latest.region_slug):buildResumeChannelMessage(latest.entity,latest.region_slug);
  if(hashMessage(latestMessage)!==hash)throw new Error('Channel publication changed');
  if(target?.message_hash===hash){summary.skipped=1;return summary;}
  const saveEdit=async(post:any)=>{
    const current=await readChannelSnapshot(client,event.entity_type,event.entity_id);
    if(!current.available||getChannelByRegionSlug(current.region_slug)!==channel)await remove(post);
    else await update(post,'active',hash,current);
  };
  if(target){
    try {
      await guard();const edited=await telegram.edit(channel,Number(target.message_id),message,{parseMode:'HTML',premiumKey:event.entity_type==='job'?'jobPublished':'resumeSaved'});
      if(edited!==true&&edited?.message_id!==Number(target.message_id))throw new Error('Telegram edit unconfirmed');
      await saveEdit(target);summary.edited=1;return summary;
    }catch(error){
      const text=error instanceof Error?error.message:String(error);
      if(/message is not modified/i.test(text)){await saveEdit(target);summary.skipped=1;return summary;}
      if(!/message to edit not found/i.test(text))throw error;
      await remove(target);
    }
  }
  await guard();
  const reserved=await client.rpc('ishdasiz_channel_send_begin',{p_token:event.lease_token,p_event:event.id,p_channel:channel,p_snapshot:latest,p_hash:hash}).abortSignal(AbortSignal.timeout(15000));
  if(reserved.error?.code==='55000')throw new ChannelDeliveryNeedsReview();
  if(reserved.error||!resumeUuid(reserved.data))throw new Error('Channel send reservation unavailable');
  const intent=reserved.data;
  const result=async(outcome:'confirmed'|'uncertain'|'rejected',id:number|null=null)=>{
    // Record a known external ID even if our lease has expired in the meantime.
    const stored=await client.rpc('ishdasiz_channel_send_result',{p_token:event.lease_token,p_intent:intent,p_outcome:outcome,p_message:id}).abortSignal(AbortSignal.timeout(15000));
    if(stored.error)throw new ChannelDeliveryNeedsReview();
    return stored.data;
  };
  let sent:any;
  try{
    // No generic retrying sendMessage wrapper is allowed for channel delivery.
    sent=await telegram.send(channel,message,{parseMode:'HTML',disableWebPagePreview:true});
    if(!Number.isSafeInteger(sent?.message_id)||sent.message_id<1)throw new Error('Telegram send unconfirmed');
  }catch(error){
    const rejected=!!error&&typeof error==='object'&&(error as {definitiveRejection?:boolean}).definitiveRejection===true;
    await result(rejected?'rejected':'uncertain');
    if(rejected)throw new Error('Telegram rejected channel send');
    throw new ChannelDeliveryNeedsReview();
  }
  const receipt=await result('confirmed',sent.message_id);
  if(!resumeUuid(receipt?.id)||receipt.channel_username!==channel||Number(receipt.message_id)!==sent.message_id||receipt.status!=='active')throw new ChannelDeliveryNeedsReview();
  summary.sent=1;
  const current=await readChannelSnapshot(client,event.entity_type,event.entity_id);
  if(!current.available||getChannelByRegionSlug(current.region_slug)!==channel)await remove(receipt);
  return summary;
}
