import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, isUuid, requireAccount } from '@/lib/auth/account';
import { normalizePhone } from '@/lib/auth/server';
import { chatRole, requireChatRole } from '@/lib/account-chat';
import { jobBelongsToEmployer } from '@/lib/account-jobs';
import { availableJobs } from '@/lib/public-job';
import { applicationQuery, applicationStats, filterApplications, publicApplication } from '@/lib/account-applications';

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request);
    const role = chatRole(request.nextUrl.searchParams.get('role'));
    const profile = await requireChatRole(client, user.id, role);
    const status = request.nextUrl.searchParams.get('status') || 'all';
    let query = filterApplications(applicationQuery(client, user.id, role, profile.id), status);
    const before = request.nextUrl.searchParams.get('before');
    if (before) {
      if (!isUuid(before)) throw new AccountError(400, 'Некорректная страница / Noto‘g‘ri sahifa');
      // Ownership is checked without the status filter: editing the last row does not break its cursor.
      const anchor = await applicationQuery(client, user.id, role, profile.id, { detail: false }).eq('id', before).maybeSingle();
      if (anchor.error) throw anchor.error;
      const cursor = anchor.data as unknown as { id: string; created_at: string } | null;
      if (!cursor) throw new AccountError(400, 'Отклик страницы недоступен / Sahifa arizasi mavjud emas');
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    }
    const [result, stats] = await Promise.all([
      query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51),
      before ? Promise.resolve(null) : applicationStats(client, user.id, role, profile.id),
    ]);
    if (result.error) throw result.error;
    const applications = (result.data || []).slice(0, 50).map((row: any) => publicApplication(row, role));
    return accountResult({ applications, stats, nextCursor: (result.data?.length || 0) > 50 ? applications.at(-1)?.id : null });
  } catch (error) { return accountFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkSameOrigin(request);
    const { client, user } = await requireAccount(request);
    await requireChatRole(client, user.id, 'job_seeker');
    let body: any;
    try { body = await request.json(); } catch { throw new AccountError(400, 'Некорректный запрос / Noto‘g‘ri so‘rov'); }
    if (!body || !isUuid(body.job_id) || !isUuid(body.resume_id)) throw new AccountError(400, 'Выберите вакансию и резюме / Vakansiya va rezyumeni tanlang');
    const phone = normalizePhone(body.phone);
    if (!phone) throw new AccountError(400, 'Введите телефон +998 и 9 цифр / +998 va 9 raqamli telefon kiriting');
    if (body.message != null && typeof body.message !== 'string') throw new AccountError(400, 'Некорректное сообщение / Noto‘g‘ri xabar');
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length > 4000) throw new AccountError(400, 'Сообщение: не более 4000 символов / Xabar: 4000 belgidan oshmasin');
    const [resume, job, employer] = await Promise.all([
      client.from('resumes').select('id,full_name').eq('id', body.resume_id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      client.from('jobs').select('id,is_active,status,source_status,is_imported,employer_id,user_id,created_by,employer_profiles(user_id)').eq('id', body.job_id).maybeSingle(),
      client.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    ]);
    if (resume.error || job.error || employer.error) throw new AccountError(503, 'Не удалось проверить отклик / Arizani tekshirib bo‘lmadi');
    if (!resume.data) throw new AccountError(404, 'Выберите своё активное резюме / O‘zingizning faol rezyumeni tanlang');
    if (job.data && jobBelongsToEmployer(job.data, user.id, employer.data?.id || null)) throw new AccountError(409, 'Нельзя откликнуться на свою вакансию / O‘z vakansiyangizga ariza yuborib bo‘lmaydi');
    if (!job.data || !(await availableJobs(client,[job.data])).length || job.data.is_imported) throw new AccountError(404, 'Вакансия недоступна для отклика / Vakansiya ariza uchun mavjud emas');
    const existing = await client.from('job_applications').select('id').eq('user_id', user.id).eq('job_id', job.data.id).limit(1).maybeSingle();
    if (existing.error) throw new AccountError(503, 'Не удалось проверить отклик / Arizani tekshirib bo‘lmadi');
    if (existing.data) throw new AccountError(409, 'Вы уже откликнулись / Siz allaqachon ariza yuborgansiz');
    // Recheck lifecycle, ownership, resume and the authenticated epoch inside
    // the same transaction as insertion, after the UI-friendly preflight.
    const result = await client.rpc('ishdasiz_submit_application',{
      p_user_id:user.id,p_session_version:user.session_version??0,p_job_id:job.data.id,p_resume_id:resume.data.id,p_phone:phone,p_message:message||null,
    });
    if (result.error?.code === '23505') throw new AccountError(409, 'Вы уже откликнулись / Siz allaqachon ariza yuborgansiz');
    if(result.error?.code==='42501')throw new AccountError(401,'Войдите повторно / Qayta kiring');
    if(result.error?.code==='P0002')throw new AccountError(404,'Вакансия или резюме больше недоступны / Vakansiya yoki rezyume endi mavjud emas');
    if(result.error?.code==='40001')throw new AccountError(409,'Вакансия изменилась или принадлежит вам / Vakansiya o‘zgargan yoki sizga tegishli');
    if (result.error || !isUuid(result.data?.id)||result.data.status!=='pending') throw new AccountError(503, 'Не удалось отправить отклик / Arizani yuborib bo‘lmadi');
    return accountResult({ application: {id:result.data.id,status:result.data.status,created_at:result.data.created_at} }, 201);
  } catch (error) { return accountFailure(error); }
}
