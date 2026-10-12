import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, isUuid, requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
import { ownResumeResult, resumeFeatures, resumeFields, ownResume, resumeInput, resumeStoragePayload } from '@/lib/account-resumes';
import { resumeLanguages } from '@/lib/resume-languages';

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request); await requireChatRole(client, user.id, 'job_seeker');
    const features = await resumeFeatures(client);
    let query = client.from('resumes').select(resumeFields(features, true)).eq('user_id', user.id).neq('status', 'archived');
    const before = request.nextUrl.searchParams.get('before');
    if (before) { const cursor = await ownResume(client, user.id, before); query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`); }
    const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51);
    if (result.error) throw result.error;
    const resumes = (result.data || []).slice(0, 50).map(row => ownResumeResult(row, features));
    return accountResult({ resumes, nextCursor: (result.data?.length || 0) > 50 ? resumes.at(-1)?.id : null });
  } catch (error) { return accountFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    checkSameOrigin(request); const { client, user } = await requireAccount(request); await requireChatRole(client, user.id, 'job_seeker');
    const body = await request.json().catch(() => null);
    if (!isUuid(body?.request_id)) throw new AccountError(400, 'Некорректный идентификатор сохранения / Saqlash identifikatori noto‘g‘ri');
    const data = await resumeStoragePayload(client, await resumeInput(client, body));
    const features = await resumeFeatures(client), fields = resumeFields(features);
    const existing = await client.from('resumes').select(fields).eq('id', body.request_id).eq('user_id', user.id).maybeSingle();
    if (existing.error) throw existing.error;
    const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    const same = (row: any) => Object.entries(data).every(([key, value]) => {
      const saved = key === 'languages' ? resumeLanguages(row[key]) : row[key] ?? null;
      const submitted = key === 'languages' ? resumeLanguages(value) : value ?? null;
      return JSON.stringify(canonical(saved)) === JSON.stringify(canonical(submitted));
    });
    if (existing.data) { if (!same(existing.data)) throw new AccountError(409, 'Резюме уже сохранено. Откройте его в списке / Rezyume saqlangan. Uni ro‘yxatda oching'); return accountResult({ resume: ownResumeResult(existing.data, features) }, 201); }
    const result = await client.from('resumes').insert({ ...data, id: body.request_id, user_id: user.id, ...(features ? { found_job: false } : {}) }).select(fields).single();
    if (result.error?.code === '23505') {
      const saved = await ownResume(client, user.id, body.request_id);
      if (same(saved)) return accountResult({ resume: saved }, 201);
      throw new AccountError(409, 'Резюме уже сохранено. Откройте список / Rezyume saqlangan. Ro‘yxatni oching');
    }
    if (result.error) throw result.error;
    if (!result.data) throw new AccountError(503, 'Не удалось сохранить резюме / Rezyumeni saqlab bo‘lmadi');
    return accountResult({ resume: ownResumeResult(result.data, features) }, 201);
  } catch (error) { return accountFailure(error); }
}
