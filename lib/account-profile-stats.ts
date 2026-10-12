import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError } from './auth/account';
import type { ChatRole } from './account-chat';
import { employerJobScope } from './account-jobs';
import { applicationQuery } from './account-applications';
export async function profileStats(client: SupabaseClient, userId: string, role: ChatRole, profileId: string) {
  const employer = role === 'employer', table = employer ? 'jobs' : 'resumes';
  let viewsField = 'views_count';
  if (!employer) {
    const probe = await client.from('resumes').select('views').limit(0);
    if (probe.error?.code === '42703' && probe.error.message?.includes('views')) viewsField = 'views_count';
    else if (probe.error) throw probe.error;
    else viewsField = 'views';
  }
  const scope = (query: any) => employer ? query.or(employerJobScope(userId, profileId)) : query.eq('user_id', userId);
  const [items, applications] = await Promise.all([
    scope(client.from(table).select('id', { count: 'exact', head: true })),
    applicationQuery(client, userId, role, profileId, { head: true }),
  ]);
  if (items.error || applications.error || items.count == null || applications.count == null) throw new AccountError(503, 'Не удалось загрузить статистику / Statistikani yuklab bo‘lmadi');
  let views = 0;
  for (let offset = 0; ; offset += 500) {
    const result = await scope(client.from(table).select(`id,${viewsField}`)).order('id').range(offset, offset + 499);
    if (result.error) throw result.error;
    for (const row of result.data || []) { const count = Number((row as any)[viewsField]); if (Number.isFinite(count) && count > 0) views += count; }
    if (!result.data || result.data.length < 500) break;
  }
  return { items: items.count, applications: applications.count, views };
}
