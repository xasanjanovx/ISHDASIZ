import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
import { APPLICATION_STATUSES } from '@/lib/application-status';
import { publicApplication, requireApplication, validApplicationVersion } from '@/lib/account-applications';
import { applicationDecisionDetails } from '@/lib/application-decision';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkSameOrigin(request);
    const { client, user } = await requireAccount(request);
    const profile = await requireChatRole(client, user.id, 'employer');
    const body = await request.json().catch(() => null);
    if (body?.action !== 'view' && body?.action !== 'status') throw new AccountError(400, 'Некорректное действие / Noto‘g‘ri amal');
    if (body.action === 'status' && (!validApplicationVersion(body.expected) || !APPLICATION_STATUSES.includes(body.status))) throw new AccountError(400, 'Некорректный статус / Noto‘g‘ri holat');
    const details = body.action === 'status' ? applicationDecisionDetails(body.details,body.status) : {};
    const application = await requireApplication(client, user.id, 'employer', profile.id, (await params).id);
    const epoch = user.session_version ?? 0;
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw new AccountError(401,'Войдите повторно / Qayta kiring');
    const result = await client.rpc('ishdasiz_web_application_action', {
      p_user_id: user.id,p_session_version: epoch,p_application_id: application.id,p_action: body.action,
      p_status: body.action === 'status' ? body.status : null,
      p_expected_status: body.action === 'status' ? body.expected.status : null,
      p_expected_responded_at: body.action === 'status' ? body.expected.responded_at : null,p_details: details,
    }).abortSignal(AbortSignal.timeout(15000));
    if (result.error) {
      const code = result.error.code;
      throw new AccountError(code === '42501' ? 403 : code === 'P0002' ? 404 : code === '40001' ? 409 : ['22023','22007','22008'].includes(code) ? 400 : 503,
        'Отклик недоступен или изменился / Ariza mavjud emas yoki o‘zgargan');
    }
    if (result.data?.id !== application.id || !validApplicationVersion(result.data) || body.action === 'status' && result.data.status !== body.status) throw new AccountError(503,'Не удалось сохранить отклик / Arizani saqlab bo‘lmadi');
    const saved = await requireApplication(client, user.id, 'employer', profile.id, application.id);
    return accountResult({ application: publicApplication(saved, 'employer') });
  } catch (error) { return accountFailure(error); }
}
