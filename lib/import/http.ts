import {timingSafeEqual} from 'crypto';
import type {NextRequest} from 'next/server';
import {AccountError,accountFailure,accountResult,checkSameOrigin} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {verifyCron} from '@/lib/auth/cron';
import {getAuthClient} from '@/lib/auth/server';
import {ImportWorkerError,readOsonishImport,stepOsonishImport} from './osonish-worker';
import {importProgress,type ImportProgress} from './progress';
import {continueOsonishImport} from './continue-osonish';

function importKey(request:NextRequest){
 const expected=process.env.IMPORT_API_KEY,incoming=request.headers.get('X-Import-Key')||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(incoming)||!timingSafeEqual(Buffer.from(expected),Buffer.from(incoming)))throw new AccountError(401,'Требуется ключ импорта / Import kaliti kerak');
}
function failure(error:unknown){
 if(error instanceof ImportWorkerError){
  const status=error.code==='42501'?403:error.code==='P0002'?404:['40001','55P03'].includes(error.code)?409:503;
  return accountFailure(new AccountError(status,status===403?'Права изменились. Обновите доступ / Huquqlar o‘zgardi. Kirishni yangilang':status===409?'Импорт уже выполняется или изменился. Обновите состояние / Import bajarilmoqda yoki o‘zgargan. Holatni yangilang':'Импорт недоступен. Повторите позже / Import mavjud emas. Keyinroq takrorlang'));
 }
 return accountFailure(error);
}
function result(value:ImportProgress){
 const progress=importProgress(value);
 return accountResult({success:progress.state==='completed',pending:progress.state==='running',progress},progress.state==='running'?202:progress.state==='completed'?200:502);
}
function statusResult(value:ImportProgress|null){return accountResult({progress:value===null?null:importProgress(value)});}
async function options(request:NextRequest){
 if(Number(request.headers.get('content-length'))>4096)throw new AccountError(400,'Запрос слишком большой / So‘rov juda katta');
 const raw=await request.text();let body;
 try{if(raw.length>4096)throw new Error();body=JSON.parse(raw);}catch{throw new AccountError(400,'Проверьте формат запроса / So‘rov formatini tekshiring');}
 if(!body||typeof body!=='object'||Array.isArray(body)||!['start','continue'].includes(body.action)||Object.keys(body).some(key=>!['action','request_id','run_id','max_pages'].includes(key))||body.action==='start'&&body.run_id!==undefined||body.action==='continue'&&(body.request_id!==undefined||body.max_pages!==undefined||typeof body.run_id!=='string'))throw new AccountError(400,'Укажите action: start с request_id или continue с run_id / action: start va request_id yoki continue va run_id ni kiriting');
 return body.action==='start'?{start:true,requestId:body.request_id,maxPages:body.max_pages??500}:{runId:body.run_id};
}
export async function adminImportGet(request:NextRequest){try{const {client,profile}=await requireAdmin(request,true);return statusResult(await readOsonishImport(client,profile.id));}catch(error){return failure(error);}}
export async function adminImportPost(request:NextRequest){try{checkSameOrigin(request);const {client,profile}=await requireAdmin(request,true);const input=await options(request);return result(await stepOsonishImport(client,{...input,actorId:profile.id}));}catch(error){return failure(error);}}
export async function cronImport(request:NextRequest){try{if(!verifyCron(request))throw new AccountError(401,'Unauthorized');return result(await stepOsonishImport(getAuthClient()));}catch(error){return failure(error);}}
export async function cronContinueImport(request:NextRequest){try{
 if(!verifyCron(request))throw new AccountError(401,'Unauthorized');
 const client=getAuthClient();
 const progress=await continueOsonishImport({read:()=>readOsonishImport(client),step:runId=>stepOsonishImport(client,{runId})});
 return progress===null?statusResult(null):result(progress);
}catch(error){return failure(error);}}
export async function keyImportGet(request:NextRequest){try{importKey(request);return statusResult(await readOsonishImport(getAuthClient()));}catch(error){return failure(error);}}
export async function keyImportPost(request:NextRequest){try{importKey(request);const input=await options(request);return result(await stepOsonishImport(getAuthClient(),input));}catch(error){return failure(error);}}
// The old two-request payload/sync protocol cannot prove that all source writes
// succeeded. Reject it explicitly instead of accepting data and skipping it.
export async function retiredImport(request:NextRequest){try{importKey(request);return accountResult({error:'Прежний протокол импорта закрыт. Используйте /api/scraper/osonish: GET — состояние; POST — start с request_id или continue с run_id. / Eski import protokoli yopildi. /api/scraper/osonish dan foydalaning.',replacement:'/api/scraper/osonish'},410);}catch(error){return failure(error);}}
