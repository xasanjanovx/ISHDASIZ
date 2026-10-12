import {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {adminIdentity,readAdminProfile,checkAdminProfile,publicAdminProfile} from '@/lib/auth/admin';

function parseEmailAllowlist(): Set<string> {
  const raw = [
    process.env.ADMIN_BOOTSTRAP_EMAILS || '',
    process.env.ADMIN_EMAILS || '',
  ]
    .join(',')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(raw);
}


export async function POST(request:NextRequest){try{
 checkSameOrigin(request);const {client,user}=await adminIdentity(request),existing=await readAdminProfile(client,user.id);
 if(existing)return accountResult({ok:true,exists:true,profile:checkAdminProfile(existing)});
 const email=String(user.email||'').trim().toLowerCase();
 if(!email||!parseEmailAllowlist().has(email)||!user.email_confirmed_at)throw new AccountError(403,'Нет прав администратора / Administrator huquqi yo‘q');
 const full_name=String(user.user_metadata?.full_name||user.user_metadata?.name||user.email||'Admin').trim().slice(0,120)||'Admin';
 const saved=await client.from('admin_profiles').upsert({id:user.id,full_name,role:'super_admin',district_id:null},{onConflict:'id',ignoreDuplicates:true}).select('id,full_name,role,district_id,created_at').maybeSingle();
 if(saved.error)throw new Error('Profile unavailable');
 const row=saved.data||await readAdminProfile(client,user.id);if(!row)throw new Error('Profile unavailable');
 return accountResult({ok:true,...(saved.data?{created:true}:{exists:true}),profile:publicAdminProfile(checkAdminProfile(row))});
}catch(error){return accountFailure(error);}}
