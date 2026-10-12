import { NextRequest } from 'next/server';
import { AccountError,accountFailure,accountResult,isUuid,requireAccount } from '@/lib/auth/account';
import { submittedResume } from '@/lib/submitted-resume';
export async function GET(request: NextRequest,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { client,user } = await requireAccount(request);
    const id = (await params).id;
    if (!isUuid(id)) throw new AccountError(404,'Резюме недоступно / Rezyume mavjud emas');
    const epoch = user.session_version ?? 0;
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw new AccountError(401,'Войдите повторно / Qayta kiring');
    const { data,error } = await client.rpc('ishdasiz_catalog_resume',{ p_user_id: user.id,p_session_version: epoch,p_resume_id: id }).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new AccountError(error.code === '42501' ? 403 : 503,'Резюме недоступно / Rezyume mavjud emas');
    if (data === null) throw new AccountError(404,'Резюме недоступно / Rezyume mavjud emas');
    if (data?.id?.toLowerCase() !== id.toLowerCase() || !isUuid(data.user_id)) throw new AccountError(503,'Не удалось загрузить резюме / Rezyumeni yuklab bo‘lmadi');
    const telegram = typeof data.telegram === 'string' && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(data.telegram) ? data.telegram : null;
    return accountResult({ resume: { ...submittedResume(data),user_id: data.user_id,telegram,created_at: typeof data.created_at === 'string' ? data.created_at : null } });
  } catch(error) { return accountFailure(error); }
}
