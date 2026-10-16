/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { readRemoteJobIds } from '@/lib/job-search-server';
jest.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }));
jest.mock('@/lib/auth/server', () => ({ getAuthClient: jest.fn() }));
const id = (n: number) => n.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000001';
let requests: URL[];
let fail = false;
let withFormat = false;
const rows = Array.from({ length: 1001 }, (_, i) => ({ id: id(i + 1), work_mode: i === 1000 ? ' Masofadan ' : 'onsite' }));
function client() {
  return createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (url: any) => {
    const u = new URL(String(url)); requests.push(u);
    const params = u.searchParams;
    if (params.get('select') === 'work_format') return new Response(withFormat ? '[]' : JSON.stringify({ code: '42703', message: 'column work_format does not exist' }), { status: withFormat ? 200 : 400 });
    if (fail) return new Response(JSON.stringify({ code: '57014', message: 'Timeout' }), { status: 400 });
    const lower = params.getAll('id').find(v => v.startsWith('gte.'))!.slice(4);
    const upper = params.getAll('id').find(v => v.startsWith('lt.'))?.slice(3);
    const after = params.getAll('id').find(v => v.startsWith('gt.'))?.slice(3);
    const records = [...rows,
      { id: 'a0000000-0000-4000-8000-000000000001', work_mode: 'onsite', source_work_type: 3 },
      { id: 'b0000000-0000-4000-8000-000000000001', work_mode: 'remote', source_work_type: 2 },
      { id: 'c0000000-0000-4000-8000-000000000001', work_mode: '', source_work_format: 'Удалённая работа' },
      ...(withFormat ? [{ id: 'd0000000-0000-4000-8000-000000000001', work_format: 'remote' }] : []),
    ].filter(r => r.id >= lower && (!upper || r.id < upper) && (!after || r.id > after));
    return new Response(JSON.stringify(records.slice(0, 1000)), { headers: { 'content-type': 'application/json' } });
  } } });
}
beforeEach(() => { requests = []; fail = false; withFormat = false; });
test('all UUID ranges and pages are scanned; source format takes priority over legacy values', async () => {
  expect(await readRemoteJobIds(client())).toEqual([id(1001),
    'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001']);
  const reads = requests.filter(r => r.searchParams.get('select') !== 'work_format');
  expect(reads).toHaveLength(17);
  expect(reads.some(r => r.searchParams.getAll('id').includes('gt.' + id(1000)))).toBe(true);
  for (const r of reads) {
    expect(r.searchParams.get('select')).not.toMatch(/\*|phone|user_id|description|raw_source_json,/);
    expect(r.searchParams.get('is_active')).toBe('eq.true');
    expect(r.searchParams.get('or')).toContain('source_status.not.in.');
  }
});
test('optional work_format is included on databases that have that column', async () => {
  withFormat = true;
  expect(await readRemoteJobIds(client())).toContain('d0000000-0000-4000-8000-000000000001');
});
test('a failed partition rejects the complete lookup rather than dropping remote vacancies', async () => {
  fail = true;
  await expect(readRemoteJobIds(client())).rejects.toMatchObject({ code: '57014' });
});
