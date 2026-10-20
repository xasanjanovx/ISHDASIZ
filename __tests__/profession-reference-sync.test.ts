/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { syncProfessionReferences } from '@/lib/import/profession-reference-sync';
const id = (n: number) => n.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000001';
const rows = Array.from({ length: 1205 }, (_, index) => ({ id: id(index + 1), category_id: 'category', position: { id: 123, position_name: 'Sotuvchi' } }));
let writes: any[], reads: URL[], fail = false;
function client() { return createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (input: any, init: any) => {
  const url = new URL(String(input)); reads.push(url);
  if (url.pathname.endsWith('/categories')) return new Response(JSON.stringify([{ id: 'category', name_uz: 'Savdo' }]));
  if (url.pathname.endsWith('/osonish_professions')) { writes.push(JSON.parse(init.body)); return new Response('[]'); }
  if (fail) return new Response(JSON.stringify({ message: 'timeout', code: '57014' }), { status: 500 });
  const comparisons = url.searchParams.getAll('id'), lower = comparisons.find(v => v.startsWith('gte.'))?.slice(4), upper = comparisons.find(v => v.startsWith('lt.'))?.slice(3), after = comparisons.find(v => v.startsWith('gt.'))?.slice(3);
  const data = rows.filter(row => (!lower || row.id >= lower) && (!upper || row.id < upper) && (!after || row.id > after)).slice(0, 500);
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
} } }); }
beforeEach(() => { writes = []; reads = []; fail = false; });
test('counts all pages of imported history instead of stopping at a REST limit', async () => {
  expect(await syncProfessionReferences(client(), AbortSignal.timeout(10000))).toEqual({ importedJobs: 1205, professions: 1 });
  expect(writes.flat()[0]).toMatchObject({ id: 123, vacancies_count: 1205, category_id: 'category' });
  const jobs = reads.filter(url => url.pathname.endsWith('/jobs'));
  expect(jobs.every(url => !url.searchParams.has('is_active'))).toBe(true);
  expect(jobs.some(url => url.searchParams.getAll('id').includes('gt.' + id(1000)))).toBe(true);
  expect(jobs.every(url => !url.searchParams.get('select')?.includes('raw_source_json,'))).toBe(true);
});
test('a failed page never publishes partial profession counts', async () => {
  fail = true;
  await expect(syncProfessionReferences(client(), AbortSignal.timeout(10000))).rejects.toThrow('Profession projection unavailable');
  expect(writes).toEqual([]);
});
