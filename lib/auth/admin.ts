import type {NextRequest} from 'next/server';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {AccountError,isUuid} from './account';
import {getAuthClient} from './server';
import {compatibleColumns} from './compatible-columns';
export type AdminIdentity={id:string;full_name:string;role:'super_admin'|'hokimlik_assistant';district_id:number|null;created_at:string;disabled_at:string|null;updated_at:string|null};
const PROFILE='id,full_name,role,district_id,created_at';
export async function adminIdentity(request:NextRequest){
 const header=request.headers.get('authorization')||'',match=header.match(/^Bearer ([^\s]+)$/i);
 if(!match||match[1].length>8192)throw new AccountError(401,'Войдите в админку / Admin panelga kiring');
 const client=getAuthClient();let result;
 try{result=await client.auth.getUser(match[1]);}catch{throw new AccountError(503,'Не удалось проверить вход / Kirishni tekshirib bo‘lmadi');}
 if(result.error){if(![400,401,403,422].includes(result.error.status||0))throw new AccountError(503,'Не удалось проверить вход / Kirishni tekshirib bo‘lmadi');throw new AccountError(401,'Войдите повторно / Qayta kiring');}
 if(!result.data?.user||!isUuid(result.data.user.id))throw new AccountError(401,'Войдите повторно / Qayta kiring');
 return {client,user:result.data.user as User};
}
export async function readAdminProfile(client:SupabaseClient,id:string){
 const result=await compatibleColumns(client,'admin_profiles',PROFILE,['disabled_at','updated_at'],'id',id);
 if(result.error)throw new AccountError(503,'Не удалось проверить права / Huquqlarni tekshirib bo‘lmadi');
 return result.data;
}
export function publicAdminProfile(row:any):AdminIdentity {
 return {id:row.id,full_name:typeof row.full_name==='string'?row.full_name:'',role:row.role,district_id:typeof row.district_id==='number'?row.district_id:null,created_at:row.created_at||'',disabled_at:row.disabled_at??null,updated_at:row.updated_at??null};
}
export function checkAdminProfile(row:any,superOnly=false){
 if(!row||row.disabled_at||!['super_admin','hokimlik_assistant'].includes(row.role)||superOnly&&row.role!=='super_admin')throw new AccountError(403,'Нет прав на это действие / Bu amal uchun huquq yo‘q');
 return publicAdminProfile(row);
}
export async function requireAdmin(request:NextRequest,superOnly=false){
 const {client,user}=await adminIdentity(request),profile=checkAdminProfile(await readAdminProfile(client,user.id),superOnly);return {client,user,profile};
}
export function adminDistrict(profile:AdminIdentity){
 if(profile.role==='super_admin')return null;
 if(!Number.isSafeInteger(profile.district_id)||!profile.district_id||profile.district_id<1)throw new AccountError(403,'Попросите главного администратора назначить ваш район / Bosh administratordan tumanni belgilashni so‘rang');
 return profile.district_id;
}
