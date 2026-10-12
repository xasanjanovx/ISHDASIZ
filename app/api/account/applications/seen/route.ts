import { NextRequest } from 'next/server';
import { AccountError,accountFailure,accountResult,checkSameOrigin,requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
import { ApplicationReadError,markApplicationsRead } from '@/lib/application-read';

export async function PATCH(request: NextRequest) {
  try {
    checkSameOrigin(request);
    const { client,user } = await requireAccount(request);
    await requireChatRole(client,user.id,'job_seeker');
    const body = await request.json().catch(() => null);
    const epoch = user.session_version ?? 0;
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw new AccountError(401,'Войдите повторно / Qayta kiring');
    return accountResult(await markApplicationsRead(client,{ userId: user.id,sessionVersion: epoch,role: 'job_seeker' },body?.applications));
  } catch (error) {
    if (error instanceof ApplicationReadError) {
      const status = error.code === '42501' ? 401 : error.code === 'P0002' ? 404 : ['22023','22007','22008'].includes(error.code) ? 400 : 503;
      return accountFailure(new AccountError(status,'Не удалось отметить отклики прочитанными / Arizalarni o‘qilgan deb belgilab bo‘lmadi'));
    }
    return accountFailure(error);
  }
}
