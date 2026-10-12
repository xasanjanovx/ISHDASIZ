import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
import { ownResumeResult, resumeFields, ownResume, resumeInput, validResumeVersion, resumeStoragePayload } from '@/lib/account-resumes';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try { const { client, user } = await requireAccount(request); await requireChatRole(client, user.id, 'job_seeker'); return accountResult({ resume: await ownResume(client, user.id, (await context.params).id) }); }
  catch (error) { return accountFailure(error); }
}
async function mutate(request: NextRequest, context: Context, action: 'edit' | 'action' | 'archive') {
  try {
    checkSameOrigin(request); const { client, user } = await requireAccount(request); await requireChatRole(client, user.id, 'job_seeker');
    const body = await request.json().catch(() => null), current = await ownResume(client, user.id, (await context.params).id);
    if (!validResumeVersion(body?.expected_updated_at)) throw new AccountError(400, 'Обновите страницу резюме / Rezyume sahifasini yangilang');
    if ((current.updated_at ?? null) !== body.expected_updated_at) throw new AccountError(409, 'Резюме уже изменилось. Обновите страницу / Rezyume o‘zgargan. Sahifani yangilang');
    let data: any;
    if (action === 'archive') data = { status: 'archived', is_public: false };
    else if (action === 'edit') {
      if (current.status === 'archived') throw new AccountError(409, 'Сначала восстановите резюме / Avval rezyumeni tiklang');
      data = await resumeStoragePayload(client, await resumeInput(client, body)); if (current.found_job) data.is_public = false;
    } else {
      if (body.action === 'restore') { if (current.status !== 'archived') throw new AccountError(409, 'Резюме не в архиве / Rezyume arxivda emas'); data = { status: 'draft', is_public: false, ...(current.supports_found_job ? { found_job: false, found_job_at: null } : {}) }; }
      else {
        if (current.status !== 'active') throw new AccountError(409, 'Опубликуйте резюме через редактирование / Rezyumeni tahrirlash orqali e’lon qiling');
        if (body.action === 'visibility' && typeof body.is_public === 'boolean' && !current.found_job) data = { is_public: body.is_public };
        else if (body.action === 'found_job' && current.supports_found_job) data = { found_job: true, found_job_at: new Date().toISOString(), is_public: false };
        else if (body.action === 'resume_search' && current.supports_found_job) data = { found_job: false, found_job_at: null, is_public: true };
        else if (body.action === 'found_job' || body.action === 'resume_search') throw new AccountError(409, 'Функция временно недоступна / Funksiya vaqtincha mavjud emas');
        else throw new AccountError(400, 'Некорректное действие / Noto‘g‘ri amal');
      }
    }
    let query = client.from('resumes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', current.id).eq('user_id', user.id);
    query = current.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', current.updated_at);
    const result = await query.select(resumeFields(current.supports_found_job)).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new AccountError(409, 'Резюме уже изменилось. Обновите страницу / Rezyume o‘zgargan. Sahifani yangilang');
    return accountResult({ resume: ownResumeResult(result.data, current.supports_found_job) });
  } catch (error) { return accountFailure(error); }
}
export const PUT = (request: NextRequest, context: Context) => mutate(request, context, 'edit');
export const PATCH = (request: NextRequest, context: Context) => mutate(request, context, 'action');
export const DELETE = (request: NextRequest, context: Context) => mutate(request, context, 'archive');
