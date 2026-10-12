import { AccountApiError } from './account-api';
export type Invitation = { id: string; created_at: string | null; seen_at: string | null; status: string | null; job_available: boolean; job: Record<string, any> | null };
export type InvitationPage = { offers: Invitation[]; nextCursor: string | null };
export type InvitationDetail = Invitation & { message: string | null; resume: { id: string; title: string | null } | null };
export function invitationErrorText(error: unknown, lang: 'ru' | 'uz') {
  const status = error instanceof AccountApiError ? error.status : 0;
  if (status === 401) return lang === 'ru' ? 'Войдите повторно, чтобы открыть приглашения.' : 'Takliflarni ochish uchun qayta kiring.';
  if (status === 403) return lang === 'ru' ? 'Сначала откройте профиль соискателя.' : 'Avval ish izlovchi profilini oching.';
  if (status === 404) return lang === 'ru' ? 'Приглашение больше недоступно.' : 'Taklif endi mavjud emas.';
  return lang === 'ru' ? 'Не удалось загрузить приглашения. Попробуйте ещё раз.' : 'Takliflarni yuklab bo‘lmadi. Qayta urinib ko‘ring.';
}
