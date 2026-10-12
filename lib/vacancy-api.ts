import {AccountApiError} from './account-api';
export type Vacancy=Record<string,any>&{id:string;updated_at:string|null};
export const vacancyState=(row:Vacancy)=>row.status==='archived'?'archived':row.status==='filled'?'filled':row.is_active===true&&[null,undefined,'active','published','open'].includes(row.status)?'active':'draft';
export function vacancyErrorText(error:unknown,lang:'ru'|'uz') {
 if(error instanceof AccountApiError) {
  if(error.detail&&[400,409].includes(error.status)){const parts=error.detail.split(' / ');return parts[lang==='ru'?0:1]||parts[0];}
  if(error.status===401)return lang==='ru'?'Войдите повторно, чтобы продолжить.':'Davom etish uchun qayta kiring.';
  if(error.status===403)return lang==='ru'?'Для работы с вакансиями создайте профиль работодателя.':'Vakansiyalar bilan ishlash uchun ish beruvchi profilini yarating.';
  if(error.status===404)return lang==='ru'?'Вакансия недоступна или принадлежит другому владельцу.':'Vakansiya mavjud emas yoki boshqa egaga tegishli.';
 }
 return lang==='ru'?'Не удалось загрузить или сохранить вакансию. Попробуйте ещё раз.':'Vakansiyani yuklab yoki saqlab bo‘lmadi. Qayta urinib ko‘ring.';
}
