import { AccountApiError } from './account-api';
import type { ApplicationStatus } from './application-status';

export interface AccountApplication {
  id: string;
  job_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: string;
  created_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  is_seen_by_job_seeker: boolean;
  resume_id: string | null;
  interview_date: string | null;
  interview_address: string | null;
  employer_phone?: string | null;
  employer_message: string | null;
  rejection_reason: string | null;
  jobs: {
    id: string; title_uz: string; title_ru: string; company_name: string;
    salary_min: number | null; salary_max: number | null;
    regions: { name_uz: string; name_ru: string } | null;
    districts: { name_uz: string; name_ru: string } | null;
  } | null;
  resumes: {
    id: string; title: string; full_name: string | null; about: string | null;
    skills: string[]; experience: unknown[];
  } | null;
}
export type ApplicationStats = Record<ApplicationStatus | 'total', number>;
export interface ApplicationPage { applications: AccountApplication[]; nextCursor: string | null; stats: ApplicationStats | null }
export function applicationErrorText(error: unknown, lang: 'uz' | 'ru') {
  const status = error instanceof AccountApiError ? error.status : 0;
  if (status === 400) return lang === 'ru' ? 'Проверьте дату, время и сообщение.' : 'Sana, vaqt va xabarni tekshiring.';
  if (status === 401) return lang === 'ru' ? 'Войдите повторно.' : 'Qayta kiring.';
  if (status === 403) return lang === 'ru' ? 'Откройте соответствующий профиль.' : 'Mos profilni oching.';
  if (status === 404) return lang === 'ru' ? 'Отклик больше недоступен.' : 'Ariza endi mavjud emas.';
  if (status === 409) return lang === 'ru' ? 'Статус уже изменился. Обновите список.' : 'Holat o‘zgargan. Ro‘yxatni yangilang.';
  return lang === 'ru' ? 'Не удалось загрузить или сохранить данные. Попробуйте ещё раз.' : 'Ma’lumotlarni yuklab yoki saqlab bo‘lmadi. Qayta urinib ko‘ring.';
}
