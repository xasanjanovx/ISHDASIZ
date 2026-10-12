import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCron } from '@/lib/auth/cron';
import { resumeUuid } from '@/lib/telegram/owned-resumes';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request: NextRequest){
 if(!verifyCron(request))return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
 const params=request.nextUrl.searchParams,entity=params.get('entity')||'all',rawLimit=params.get('limit')||'200';
 const afterType=params.get('after_type'),afterId=params.get('after_id');
 if(!['all','job','resume'].includes(entity)||!/^\d+$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>5000
  ||(afterType===null)!==(afterId===null)||afterType!==null&&!['job','resume'].includes(afterType)||afterId!==null&&!resumeUuid(afterId))return NextResponse.json({success:false,error:'Invalid seed parameters'},{status:400});
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({success:false,error:'Channel queue is not configured'},{status:503});
 try{
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await client.rpc('ishdasiz_seed_channel_sync',{p_type:entity,p_limit:Number(rawLimit),p_after_type:afterType,p_after_id:afterId}).abortSignal(AbortSignal.timeout(60000));
  const data=result.data;
  if(result.error||!data||!['scanned','jobs','resumes'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0)||data.scanned>Number(rawLimit)||data.jobs+data.resumes>data.scanned||typeof data.has_more!=='boolean'
   ||data.scanned>0&&(!resumeUuid(data.after_id)||!['job','resume'].includes(data.after_type)))throw new Error('Channel seed unconfirmed');
  return NextResponse.json({success:true,entity,limit:Number(rawLimit),scanned:data.scanned,inserted:{jobs:data.jobs,resumes:data.resumes,total:data.jobs+data.resumes},nextCursor:data.has_more?{type:data.after_type,id:data.after_id}:null});
 }catch{return NextResponse.json({success:false,error:'Channel queue unavailable'},{status:503});}
}
export async function POST(request:NextRequest){return GET(request);}
