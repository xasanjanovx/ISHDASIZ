import {accountApi,AccountApiError} from './account-api';
export function adminApi<T>(token:string|null|undefined,url:string,init:RequestInit={}){
 if(!token)return Promise.reject(new AccountApiError(401));
 return accountApi<T>(url,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`}});
}
export function adminErrorText(error:unknown,ru:boolean){
 if(error instanceof AccountApiError){
  if(error.status===401)return ru?'Войдите в админку повторно.':'Admin panelga qayta kiring.';
  if(error.detail&&[400,403,404,409,429].includes(error.status)){const parts=error.detail.split(' / ');return parts[ru?0:1]||parts[0];}
 }
 return ru?'Не удалось загрузить или сохранить данные. Попробуйте ещё раз.':'Ma’lumotlarni yuklab yoki saqlab bo‘lmadi. Qayta urinib ko‘ring.';
}
