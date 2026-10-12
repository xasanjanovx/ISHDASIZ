import type { NextRequest } from 'next/server';
import { AccountError,accountFailure,requireAccount } from './auth/account';
import { requireChatRole } from './account-chat';
import { OfferError,validOfferCursor,type OfferCursor,type SeekerOffer,type SeekerOfferDetail } from './telegram/seeker-offers';
import type { Invitation,InvitationDetail } from './invitation-api';
export async function offerAccount(request: NextRequest) {
  const { client,user } = await requireAccount(request);
  await requireChatRole(client,user.id,'job_seeker');
  return { client,actor: { user_id: user.id,data: { active_role: 'job_seeker',account_session_version: user.session_version ?? 0 } } };
}
export function parseOfferCursor(value: string | null): OfferCursor | null {
  if (value === null) return null;
  try {
    if (!value || value.length > 250 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if (!validOfferCursor(cursor) || Object.keys(cursor).some(key => key !== 'id' && key !== 'created_at')) throw new Error();
    return cursor;
  } catch { throw new AccountError(400,'Некорректная страница / Noto‘g‘ri sahifa'); }
}
export const offerCursor = (value: OfferCursor | null) => value ? Buffer.from(JSON.stringify(value)).toString('base64url') : null;
export function publicOffer(value: SeekerOffer): Invitation {
  return { id: value.id,status: value.status,created_at: value.created_at,seen_at: value.seen_at,job_available: value.job_available,job: value.job };
}
export function publicOfferDetail(value: SeekerOfferDetail): InvitationDetail {
  return { ...publicOffer(value),message: value.message,resume: value.resume ? { id: value.resume.id,title: typeof value.resume.title === 'string' ? value.resume.title : null } : null };
}
export function offerFailure(error: unknown) {
  if (error instanceof OfferError) return accountFailure(new AccountError(error.code === 'identity' ? 401 : error.code === 'invalid' ? 400 : error.code === 'missing' ? 404 : 503,
    error.code === 'identity' ? 'Войдите повторно / Qayta kiring' : 'Приглашения временно недоступны / Takliflar vaqtincha mavjud emas'));
  return accountFailure(error);
}
