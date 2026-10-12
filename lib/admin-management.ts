import {createHmac} from 'crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountError,isUuid} from './auth/account';
import {publicAdminProfile,type AdminIdentity} from './auth/admin';
import {validResumeVersion} from './account-resumes';
export type ManagedAdmin=AdminIdentity&{email:string|null;districts:{name_uz:string|null;name_ru:string|null;region_id:number|null;regions:{name_uz:string|null;name_ru:string|null}|null}|null};
export type AdminManagementPage={admins:ManagedAdmin[];page:number;total:number;hasMore:boolean};
const invalid=(ru:string,uz:string):never=>{throw new AccountError(400,`${ru} / ${uz}`);};
export function adminProfileInput(body:any){
 if(!body||typeof body!=='object'||Array.isArray(body))return invalid('Некорректная форма','Forma noto‘g‘ri');
 if(typeof body.full_name!=='string'||!body.full_name.trim()||body.full_name.length>120)return invalid('Имя: от 1 до 120 символов','Ism: 1 dan 120 ta belgigacha');
 if(!['super_admin','hokimlik_assistant'].includes(body.role))return invalid('Выберите роль из списка','Rolni ro‘yxatdan tanlang');
 const district=body.role==='super_admin'?null:body.district_id;
 if(body.role==='hokimlik_assistant'&&(!Number.isSafeInteger(district)||district<1||district>2147483647))return invalid('Помощнику нужно назначить район','Yordamchiga tuman belgilash kerak');
 return {full_name:body.full_name.trim(),role:body.role,district_id:district};
}
export function adminCreationInput(body:any){
 const profile=adminProfileInput(body);
 if(!isUuid(body.request_id))return invalid('Обновите форму создания','Yaratish formasini yangilang');
 if(typeof body.email!=='string'||body.email.trim().length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return invalid('Проверьте email','Emailni tekshiring');
 if(typeof body.password!=='string'||body.password.length<12||Buffer.byteLength(body.password,'utf8')>72)return invalid('Пароль: от 12 символов, до 72 байт','Parol: kamida 12 ta belgi, 72 baytgacha');
 return {request_id:body.request_id.toLowerCase(),email:body.email.trim().toLowerCase(),password:body.password,...profile};
}
export function managedAdminResult(row:any):ManagedAdmin{
 if(!row||!isUuid(row.id))throw new Error('Admin profile result unavailable');
 const names=(value:any)=>value?{name_uz:typeof value.name_uz==='string'?value.name_uz:null,name_ru:typeof value.name_ru==='string'?value.name_ru:null}:null;
 return {...publicAdminProfile(row),email:typeof row.email==='string'?row.email:null,districts:row.districts?{...names(row.districts)!,region_id:Number.isSafeInteger(row.districts.region_id)?row.districts.region_id:null,regions:names(row.districts.regions)}:null};
}
export async function managementRPC(client:SupabaseClient,name:string,args:Record<string,any>){
 const result=await client.rpc(name,args);
 const code=result.error?.code;
 if(code==='42501')throw new AccountError(403,'Права изменились. Обновите доступ / Huquqlar o‘zgardi. Kirishni yangilang');
 if(code==='P0002')throw new AccountError(404,'Администратор недоступен / Administrator mavjud emas');
 if(code==='55P03')throw new AccountError(409,'Создание ещё выполняется. Повторите с этой же формой через две минуты / Yaratish davom etmoqda. Ikki daqiqadan keyin shu forma bilan takrorlang');
 if(['40001','23505'].includes(code||''))throw new AccountError(409,'Данные изменились. Обновите список или проверьте email / Ma’lumotlar o‘zgardi. Ro‘yxatni yangilang yoki emailni tekshiring');
 if(code==='22023')throw new AccountError(400,'Проверьте роль, имя и назначенный район / Rol, ism va belgilangan tumanni tekshiring');
 if(result.error)throw result.error;
 return result.data;
}
export async function listManagedAdmins(client:SupabaseClient,profile:AdminIdentity,page:number,state:string,search:string):Promise<AdminManagementPage>{
 if(!Number.isSafeInteger(page)||page<0||page>100000||!['all','active','disabled'].includes(state)||search.length>100)invalid('Проверьте фильтр и страницу','Filtr va sahifani tekshiring');
 const result=await managementRPC(client,'ishdasiz_admin_list_profiles',{p_actor_id:profile.id,p_page:page,p_state:state,p_search:search});
 if(!result||!Array.isArray(result.admins)||!Number.isSafeInteger(result.total)||result.total<0)throw new Error('Admin list unavailable');
 return {admins:result.admins.map(managedAdminResult),total:result.total,page,hasMore:(page+1)*50<result.total};
}
export async function createManagedAdmin(client:SupabaseClient,profile:AdminIdentity,body:any){
 const input=adminCreationInput(body),key=process.env.AUTH_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SERVICE_KEY;
 if(!key)throw new Error('Creation fingerprint unavailable');
 const fingerprint=createHmac('sha256',key).update(JSON.stringify(input)).digest('hex');
 const reservation=await managementRPC(client,'ishdasiz_admin_reserve_creation',{p_actor_id:profile.id,p_request_id:input.request_id,p_fingerprint:fingerprint,p_profile:{email:input.email,full_name:input.full_name,role:input.role,district_id:input.district_id}});
 if(reservation?.profile)return managedAdminResult(reservation.profile);
 if(!isUuid(reservation?.target_id)||!isUuid(reservation?.lease_id))throw new Error('Creation reservation unavailable');
 const metadata={ishdasiz_admin_request:input.request_id,ishdasiz_admin_actor:profile.id};
 try{
  // The server-reserved ID is reused after uncertain responses. Never reset an
  // existing password, adopt an unrelated account, or delete an uncertain user.
  let existing=await client.auth.admin.getUserById(reservation.target_id);
  if(existing.error&&existing.error.code!=='user_not_found'&&existing.error.status!==404)throw existing.error;
  if(!existing.data.user){
   const created=await client.auth.admin.createUser({id:reservation.target_id,email:input.email,password:input.password,email_confirm:true,app_metadata:metadata,user_metadata:{full_name:input.full_name}});
   if(created.error){
    existing=await client.auth.admin.getUserById(reservation.target_id);
    if(!existing.data.user){
     if(['email_exists','user_already_exists'].includes(created.error.code||''))throw new AccountError(409,'Email уже используется. Проверьте список администраторов / Email band. Administratorlar ro‘yxatini tekshiring');
     throw created.error;
    }
   }else existing={data:{user:created.data.user},error:null};
  }
  const user=existing.data.user;
  if(!user||user.id!==reservation.target_id||user.email?.toLowerCase()!==input.email||user.app_metadata?.ishdasiz_admin_request!==input.request_id||user.app_metadata?.ishdasiz_admin_actor!==profile.id)throw new AccountError(409,'Этот вход не относится к вашей операции создания / Ushbu kirish sizning yaratish amalingizga tegishli emas');
  const result=await managementRPC(client,'ishdasiz_admin_complete_creation',{p_actor_id:profile.id,p_request_id:input.request_id,p_lease_id:reservation.lease_id});
  return managedAdminResult(result);
 }finally{
  // Releasing a stale lease cannot undo a committed profile or another retry.
  try{await client.rpc('ishdasiz_admin_release_creation',{p_actor_id:profile.id,p_request_id:input.request_id,p_lease_id:reservation.lease_id});}catch{/* Lease expiry permits recovery without changing an uncertain result. */}
 }
}
export async function updateManagedAdmin(client:SupabaseClient,profile:AdminIdentity,id:unknown,body:any){
 if(!isUuid(id))throw new AccountError(404,'Администратор недоступен / Administrator mavjud emas');
 if(!body||!body.expected_updated_at||!validResumeVersion(body.expected_updated_at)||!['edit','disable','enable'].includes(body.action))invalid('Обновите администратора перед изменением','O‘zgartirishdan oldin administratorni yangilang');
 const payload=body.action==='edit'?adminProfileInput(body):{};
 return managedAdminResult(await managementRPC(client,'ishdasiz_admin_update_profile',{p_actor_id:profile.id,p_target_id:id,p_action:body.action,p_payload:payload,p_expected_version:body.expected_updated_at}));
}
