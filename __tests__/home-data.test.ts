import { HOME_JOB_FIELDS, loadHomeData, parseHomeCounts } from '@/lib/home-data';
import type { SupabaseClient } from '@supabase/supabase-js';
const category = '20000000-0000-4000-8000-000000000001';
function fixture(countError = false, malformed = false) {
  const chains: Record<string, any> = {};
  const chain = (result: any) => { const q: any = {}; for (const name of ['select', 'eq', 'neq', 'order', 'limit', 'abortSignal']) q[name] = jest.fn(() => q); q.then = (done: any) => Promise.resolve(result).then(done); return q; };
  const client = { from: jest.fn((table: string) => chains[table] = chain({ data: table === 'jobs' ? [{ id: 'public-job' }] : table === 'categories' ? [{ id: category }] : [], count: table === 'employer_profiles' ? 12 : null, error: null })),
    rpc: jest.fn(() => chain({ data: malformed ? { total: -1 } : { total: 24666, categories: { [category]: 101 }, special: { students: 2002, disabled: 637, women: 18000 } }, error: countError ? { code: '57014' } : null })) };
  return { client, chains };
}
test('loads homepage cards once without a REST count and shares one aggregate across all counters', async () => {
  const { client, chains } = fixture(); const data = await loadHomeData(client as unknown as SupabaseClient, async () => ({ totalUsers: 614, archivedJobs: 37069 }));
  expect(client.rpc).toHaveBeenCalledTimes(1); expect(client.rpc).toHaveBeenCalledWith('ishdasiz_public_home_counts');
  expect(client.from.mock.calls.filter(([table]) => table === 'jobs')).toHaveLength(1);
  expect(chains.jobs.select).toHaveBeenCalledWith(HOME_JOB_FIELDS);
  expect(client.from).not.toHaveBeenCalledWith('employer_profiles');
  expect(HOME_JOB_FIELDS).not.toMatch(/\*|phone|raw_source_json|user_id/);
  expect(data).toMatchObject({ stats: { totalJobs: 24666, totalUsers: 614, archivedJobs: 37069 }, jobCounts: { [category]: 101 }, specialCounts: { students: 2002, disabled: 637, women: 18000 }, unavailable: false });
});
test.each([[true, false], [false, true]])('keeps unavailable counters explicit when the aggregate fails or is malformed', async (error, malformed) => {
  const { client } = fixture(error, malformed); const data = await loadHomeData(client as unknown as SupabaseClient, async () => ({ totalUsers: 614, archivedJobs: 37069 }));
  expect(data.jobs).toHaveLength(1); expect(data.stats.totalJobs).toBeNull(); expect(data.jobCounts[category]).toBeNull(); expect(data.specialCounts.women).toBeNull(); expect(data.unavailable).toBe(true);
});
test('validates category totals and overlapping special groups without inventing data', () => {
  expect(parseHomeCounts({ total: 0, categories: {}, special: { students: 0, disabled: 0, women: 0 } }).total).toBe(0);
  for (const value of [{ total: 1, categories: { [category]: 2 }, special: { students: 0, disabled: 0, women: 0 } }, { total: 1, categories: {}, special: { students: 0, disabled: 0, women: 2 } }, { total: 1, categories: [], special: {} }]) expect(() => parseHomeCounts(value)).toThrow();
});
