import type { SupabaseClient } from '@supabase/supabase-js';
import { parseHomeCounts } from './home-data';
import { readOsonishImport } from './import/osonish-worker';

import type { HomeOverview } from './home-overview-types';
export type { HomeOverview } from './home-overview-types';
type Scope = { key: string; category?: string; special?: 'students' | 'disabled' | 'women'; source?: string };
const closed = ['archived', 'closed', 'filled', 'inactive'];
const sourceClosed = ['filled', 'removed_at_source', 'archived', 'inactive', 'closed'];
const publishedStatus = 'or(status.is.null,status.in.(active,published,open))';
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// Service-only reads: archived records and import capabilities never leave the server.
// Exact HEAD counts use disjoint archive slices; bounded workers share one cached result.
export async function readHomeOverview(client: SupabaseClient, now = Date.now): Promise<HomeOverview> {
  const [aggregate, categories, progress] = await Promise.all([
    client.rpc('ishdasiz_public_home_counts').abortSignal(AbortSignal.timeout(15000)),
    client.from('categories').select('id').neq('id', 'a0000011-0011-4000-8000-000000000011').order('id').abortSignal(AbortSignal.timeout(15000)),
    readOsonishImport(client).catch(() => null),
  ]);
  if (aggregate.error || categories.error || !Array.isArray(categories.data)) throw new Error('Home overview unavailable');
  const active = parseHomeCounts(aggregate.data);
  const scopes: Scope[] = categories.data.map(({ id }) => {
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid category');
    return { key: id, category: id };
  });
  scopes.push(...(['students', 'disabled', 'women'] as const).map(special => ({ key: special, special })), { key: 'osonish', source: 'osonish' });
  const totals = new Map<string, number>();
  for (const scope of scopes) totals.set(scope.key, scope.category ? active.categories[scope.key] || 0 : scope.special ? active.special[scope.special] : 0);
  const tasks: (() => Promise<void>)[] = [];
  for (const scope of scopes) {
    for (const sourceSlice of [false, true]) tasks.push(async () => {
      let query = client.from('jobs').select('id', { count: 'exact', head: true }).eq('ishdasiz_job_available', false);
      query = sourceSlice ? query.in('source_status', sourceClosed) : query.in('status', closed);
      if (scope.category) query = query.eq('category_id', scope.category);
      if (scope.source) query = query.eq('source', scope.source);
      const clauses = sourceSlice ? [publishedStatus] : [];
      if (scope.special === 'students') clauses.push('or(is_for_students.eq.true,is_for_graduates.eq.true)');
      if (scope.special === 'disabled') query = query.eq('is_for_disabled', true);
      if (scope.special === 'women') clauses.push('or(is_for_women.eq.true,gender.eq.female,gender.eq.2,gender.eq.any,gender.eq.3,gender.is.null)');
      if (clauses.length) query = query.or(`and(${clauses.join(',')})`);
      const result = await query.abortSignal(AbortSignal.timeout(15000));
      if (result.error || !count(result.count)) throw new Error('Archive counts unavailable');
      totals.set(scope.key, totals.get(scope.key)! + result.count);
    });
  }
  tasks.push(async () => {
    const result = await client.from('jobs').select('id', { count: 'exact', head: true })
      .eq('ishdasiz_job_available', true).eq('source', 'osonish').abortSignal(AbortSignal.timeout(15000));
    if (result.error || !count(result.count)) throw new Error('Source count unavailable');
    totals.set('osonish', totals.get('osonish')! + result.count);
  });
  let failed = false;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (tasks.length && !failed) {
      try { await tasks.shift()!(); } catch { failed = true; }
    }
  }));
  if (failed || Array.from(totals.values()).some(value => !count(value))) throw new Error('Home overview unavailable');
  const timestamp = now();
  return {
    categoryCounts: Object.fromEntries(scopes.filter(scope => scope.category).map(scope => [scope.key, totals.get(scope.key)!])),
    specialCounts: { students: totals.get('students')!, disabled: totals.get('disabled')!, women: totals.get('women')! },
    source: {
      imported: totals.get('osonish')!,
      run: progress ? {
        state: progress.state === 'running' && progress.last_error ? 'retrying' : progress.state,
        startedAt: progress.started_at, completedAt: progress.completed_at, processed: progress.processed, total: progress.total,
        added: progress.new_imported, updated: progress.updated,
        elapsedSeconds: Math.max(0, Math.floor(((progress.completed_at ? Date.parse(progress.completed_at) : timestamp) - Date.parse(progress.started_at)) / 1000)),
      } : null,
    },
    asOf: new Date(timestamp).toISOString(),
  };
}
