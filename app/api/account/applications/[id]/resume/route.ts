import { NextRequest } from 'next/server';
import { AccountError,accountFailure,accountResult,isUuid,requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
import { submittedResume } from '@/lib/submitted-resume';
export async function GET(request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { client,user } = await requireAccount(request);
    await requireChatRole(client,user.id,'employer');
    const id = (await params).id;
    if (!isUuid(id)) throw new AccountError(404,'Резюме недоступно / Rezyume mavjud emas');
    const epoch = user.session_version ?? 0;
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw new AccountError(401,'Войдите повторно / Qayta kiring');
    const { data,error } = await client.rpc('ishdasiz_application_resume',{ p_user_id: user.id,p_session_version: epoch,p_application_id: id }).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new AccountError(error.code === '42501' ? 401 : 503,'Резюме недоступно / Rezyume mavjud emas');
    if (data === null) throw new AccountError(404,'Резюме недоступно / Rezyume mavjud emas');
    if (data?.application_id !== id || !isUuid(data.resume?.id) || data.resume.status !== 'active') throw new AccountError(503,'Не удалось загрузить резюме / Rezyumeni yuklab bo‘lmadi');
    return accountResult({ resume: submittedResume(data.resume) });
  } catch(error) { return accountFailure(error); }
}
