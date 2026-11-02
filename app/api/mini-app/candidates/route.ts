import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,isUuid,requireAccount} from '@/lib/auth/account';
import {miniCandidateContext,miniCandidateRows} from '@/lib/mini-app/candidates';
export async function GET(request:NextRequest){try{
 const {client,user}=await requireAccount(request),id=request.nextUrl.searchParams.get('id')||'',contact=request.nextUrl.searchParams.get('resume_id');
 const context=await miniCandidateContext(client,user,id);
 if(!context.unlocked){
  if(contact)throw new AccountError(403,'Avval shu vakansiyani kanalga joylang');
  const [total,potential]=await Promise.all([client.from('resumes').select('id',{head:true,count:'exact'}).eq('ishdasiz_resume_available',true),
   client.from('resumes').select('id',{head:true,count:'exact'}).eq('ishdasiz_resume_available',true).eq('category_id',context.job.category_id)]);
  if(total.error||potential.error)throw Error('Count unavailable');
  return accountResult({locked:true,total:total.count,potential:potential.count});
 }
 if(contact&&!isUuid(contact))throw new AccountError(400,'Nomzodni tanlang');
 const matches=await miniCandidateRows(client,context,contact||undefined);
 if(contact){const match=matches.find(m=>m.row.id===contact);if(!match)throw new AccountError(404,'Mos nomzod mavjud emas');
  const viewed=await client.rpc('ishdasiz_mini_app_resume_view',{p_user:user.id,p_version:user.session_version??0,p_job:id,p_resume:contact});
  if(viewed.error||viewed.data!==true)throw new AccountError(403,'Nomzod hozir mavjud emas. Vakansiyani yangilang.');
  if(request.nextUrl.searchParams.get('action')==='view')return accountResult({resume:{id:match.row.id,title:match.row.title,full_name:match.row.full_name,about:match.row.about,skills:match.row.skills,reasons:match.reasons,issues:match.issues}});
  return accountResult({contact:{full_name:match.row.full_name,phone:match.row.phone}});}
 const relation=(v:any)=>Array.isArray(v)?v[0]:v;
 // Return derived distance and district only, never a candidate's private coordinates.
 return accountResult({locked:false,candidates:matches.slice(0,50).map(({row,...match})=>({id:row.id,title:row.title,full_name:row.full_name,about:row.about,skills:row.skills,
  location:[relation(row.regions)?.name_uz,relation(row.districts)?.name_uz].filter(Boolean).join(' · '),...match})),hasMore:matches.length>50});
}catch(e){return accountFailure(e);}}
