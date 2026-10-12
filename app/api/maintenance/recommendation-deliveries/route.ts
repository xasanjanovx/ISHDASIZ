import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCron } from '@/lib/auth/cron';
import { resumeUuid, resumeVersion } from '@/lib/telegram/owned-resumes';
export const dynamic='force-dynamic';
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const configured=()=>!!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
export async function GET(request:NextRequest){
 if(!verifyCron(request))return NextResponse.json({error:'Unauthorized'},{status:401});
 const after=request.nextUrl.searchParams.get('after');
 if(after!==null&&!resumeUuid(after))return NextResponse.json({error:'Invalid cursor'},{status:400});
 if(!configured())return NextResponse.json({error:'Recommendation maintenance unavailable'},{status:503});
 try{
  let query=client().from('job_auto_matches').select('id,job_id,resume_id,notification_state,notification_attempted_at').in('notification_state',['sending','uncertain']).order('id',{ascending:true}).limit(101);
  if(after)query=query.gt('id',after);
  const loaded=await query.abortSignal(AbortSignal.timeout(15000));
  if(loaded.error||!Array.isArray(loaded.data))throw new Error('Queue unavailable');
  const items=loaded.data.slice(0,100);
  return NextResponse.json({items,nextCursor:loaded.data.length>100?items[99].id:null},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Recommendation maintenance unavailable'},{status:503});}
}
export async function POST(request:NextRequest){
 if(!verifyCron(request))return NextResponse.json({error:'Unauthorized'},{status:401});
 let body:any;
 try{
  const text=await request.text();if(text.length>4096)throw new Error('Too large');body=JSON.parse(text);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['matchId','expectedAttemptedAt','resolution','messageId'].includes(key))
   ||!resumeUuid(body.matchId)||typeof body.expectedAttemptedAt!=='string'||!resumeVersion(body.expectedAttemptedAt)||!['verified_message','verified_not_delivered'].includes(body.resolution)
   ||body.resolution==='verified_message'&&(!Number.isSafeInteger(body.messageId)||body.messageId<1)
   ||body.resolution==='verified_not_delivered'&&body.messageId!==undefined)throw new Error('Invalid resolution');
 }catch{return NextResponse.json({error:'Supply the notification attempt version and an explicitly verified resolution'},{status:400});}
 if(!configured())return NextResponse.json({error:'Recommendation maintenance unavailable'},{status:503});
 try{
  const result=await client().rpc('ishdasiz_auto_match_resolve',{p_match:body.matchId,p_expected_attempted:body.expectedAttemptedAt,p_message:body.messageId??null,p_not_delivered:body.resolution==='verified_not_delivered'}).abortSignal(AbortSignal.timeout(15000));
  if(result.error?.code==='55000'||!result.error&&result.data===false)return NextResponse.json({error:'Delivery is in flight or its version changed; reload before resolving'},{status:409});
  if(result.error||result.data!==true)throw new Error('Resolution unavailable');
  return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Recommendation resolution unavailable'},{status:503});}
}
