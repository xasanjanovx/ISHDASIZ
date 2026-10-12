import type { SupabaseClient } from '@supabase/supabase-js';
import { employerJobScope } from './account-jobs';
import { profileStats } from './account-profile-stats';
import { vacancyQuery } from './account-vacancies';

export interface EmployerStatistics {
  items: number;
  active: number;
  views: number;
  applications: number;
}
export interface VacancyStatistics {
  id: string;
  title_uz: string | null;
  title_ru: string | null;
  created_at: string;
  available: boolean;
  views: number;
  applications: number;
}
export interface EmployerStatisticsPage {
  stats: EmployerStatistics | null;
  jobs: VacancyStatistics[];
  nextCursor: string | null;
}

export async function employerStatistics(client: SupabaseClient, userId: string, employerId: string) {
  const [totals, active] = await Promise.all([
    profileStats(client, userId, 'employer', employerId),
    vacancyQuery(client, userId, employerId, 'id', 'all', undefined, true).eq('ishdasiz_job_available', true),
  ]);
  if (active.error || active.count == null) throw new Error('Active count unavailable');
  return { ...totals, active: active.count };
}

/** Count every application in the current page, checking current job ownership on every read. */
export async function employerApplicationCounts(client: SupabaseClient, userId: string, employerId: string, ids: string[]) {
  const counts: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
  if (!ids.length) return counts;
  let after: string | undefined;
  for (;;) {
    let query = client.from('job_applications').select('id,job_id,jobs!inner(id)')
      .or(employerJobScope(userId, employerId), { referencedTable: 'jobs' }).in('job_id', ids)
      .order('id', { ascending: true }).limit(500);
    if (after) query = query.gt('id', after);
    const result = await query;
    if (result.error || !Array.isArray(result.data)) throw new Error('Application counts unavailable');
    for (const row of result.data) if (row.job_id in counts) counts[row.job_id]++;
    if (result.data.length < 500) return counts;
    const next = result.data.at(-1)?.id;
    if (!next || after && next <= after) throw new Error('Application page did not advance');
    after = next;
  }
}
