import { NextRequest } from 'next/server';
import { accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
import { ownVacancy, vacancyQuery } from '@/lib/account-vacancies';
import { employerApplicationCounts, employerStatistics, type VacancyStatistics } from '@/lib/employer-statistics';

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request);
    const employer = await requireChatRole(client, user.id, 'employer');
    const before = request.nextUrl.searchParams.get('before');
    const cursor = before ? await ownVacancy(client, user.id, employer.id, before) : undefined;
    const fields = 'id,title_uz,title_ru,created_at,views_count,ishdasiz_job_available';
    const result = await vacancyQuery(client, user.id, employer.id, fields, 'all', cursor)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(26);
    if (result.error || !Array.isArray(result.data)) throw new Error('Vacancy statistics unavailable');
    const rows = (result.data as any[]).slice(0, 25);
    const [counts, stats] = await Promise.all([
      employerApplicationCounts(client, user.id, employer.id, rows.map(row => row.id)),
      before ? Promise.resolve(null) : employerStatistics(client, user.id, employer.id),
    ]);
    const jobs: VacancyStatistics[] = rows.map(row => ({
      id: row.id, title_uz: row.title_uz, title_ru: row.title_ru, created_at: row.created_at,
      available: row.ishdasiz_job_available === true,
      views: Number.isFinite(Number(row.views_count)) ? Math.max(0, Number(row.views_count)) : 0,
      applications: counts[row.id],
    }));
    return accountResult({ stats, jobs, nextCursor: result.data.length > 25 ? jobs.at(-1)?.id : null });
  } catch (error) { return accountFailure(error); }
}
