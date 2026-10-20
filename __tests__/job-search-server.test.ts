/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { readIndexedRemoteJobIds, readRemoteJobIds } from '@/lib/job-search-server';
jest.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }));
jest.mock('@/lib/auth/server', () => ({ getAuthClient: jest.fn() }));
const id = (n: number) => n.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000001';
let requests: URL[];
let fail = false;
let failOnce = false;
let withFormat = false;
const rows = Array.from({ length: 1001 }, (_, i) => ({ id: id(i + 1), work_mode: i === 1000 ? ' Masofadan ' : 'onsite' }));
function client() {
  return createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (url: any) => {
    const u = new URL(String(url)); requests.push(u);
    const params = u.searchParams;
    if (params.get('select') === 'work_format') return new Response(withFormat ? '[]' : JSON.stringify({ code: '42703', message: 'column work_format does not exist' }), { status: withFormat ? 200 : 400 });
    if (failOnce) { failOnce = false; return new Response(JSON.stringify({ code: '57014', message: 'Timeout' }), { status: 500 }); }
    if (fail) return new Response(JSON.stringify({ code: '57014', message: 'Timeout' }), { status: 400 });
    const lower = params.getAll('id').find(v => v.startsWith('gte.'))?.slice(4);
    const only = params.getAll('id').find(v => v.startsWith('in.'))?.slice(4, -1).split(',');
    const upper = params.getAll('id').find(v => v.startsWith('lt.'))?.slice(3);
    const after = params.getAll('id').find(v => v.startsWith('gt.'))?.slice(3);
    const records = [...rows,
      { id: 'a0000000-0000-4000-8000-000000000001', work_mode: 'onsite', source_work_type: 3 },
      { id: 'b0000000-0000-4000-8000-000000000001', work_mode: 'remote', source_work_type: 2 },
      { id: 'c0000000-0000-4000-8000-000000000001', work_mode: '', source_work_format: 'Удалённая работа' },
      ...(withFormat ? [{ id: 'd0000000-0000-4000-8000-000000000001', work_format: 'remote' }] : []),
    ].filter(r => (!lower || r.id >= lower) && (!upper || r.id < upper) && (!after || r.id > after) && (!only || only.includes(r.id)));
    const projected = !params.get('select')!.includes('source_workplace_type')
      ? records.map(row => ({ id: row.id, source_work_type: row.source_work_type, work_mode: row.work_mode, ...(withFormat ? {work_format: row.work_format} : {}) })) : records;
    return new Response(JSON.stringify(projected.slice(0, Number(params.get('limit') || 1000))), { headers: { 'content-type': 'application/json' } });
  } } });
}
beforeEach(() => { requests = []; fail = false; failOnce = false; withFormat = false; });
test('all UUID ranges and pages are scanned; source format takes priority over legacy values', async () => {
  expect(await readRemoteJobIds(client())).toEqual([id(1001),
    'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001']);
  const reads = requests.filter(r => r.searchParams.get('select') !== 'work_format');
  const scans = reads.filter(r => !r.searchParams.get('select')!.includes('source_workplace_type'));
  expect(scans).toHaveLength(17);
  expect(scans.some(r => r.searchParams.getAll('id').includes('gt.' + id(1000)))).toBe(true);
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
  const reads = requests.filter(r => r.searchParams.get('select') !== 'work_format');
  expect(reads.length).toBeLessThanOrEqual(8);
});

test('numeric source records and explicit modes skip legacy JSON extraction while all other format sources stay supported', async () => {
  await readRemoteJobIds(client());
  const detailRequests = requests.filter(r => r.searchParams.get('select')?.includes('source_workplace_type'));
  const detailIds = detailRequests.flatMap(r => r.searchParams.get('id')!.slice(4, -1).split(','));
  expect(detailIds).not.toContain('a0000000-0000-4000-8000-000000000001');
  expect(detailIds).not.toContain('b0000000-0000-4000-8000-000000000001');
  expect(detailIds).toContain('c0000000-0000-4000-8000-000000000001');
  expect(detailIds).not.toContain(id(1));
  expect(new Set(detailIds).size).toBe(1);
});

test('a transient failed page is retried without losing remote vacancies', async () => {
  failOnce = true;
  expect(await readRemoteJobIds(client())).toEqual([id(1001),
    'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001']);
  const reads = requests.filter(r => r.searchParams.get('select') !== 'work_format');
  expect(new Set(reads.map(String)).size).toBe(reads.length - 1);
});

test('indexed lookup pages only IDs through the remote index and rejects partial failed reads', async () => {
  const seen: URL[] = [];
  const remote = Array.from({ length: 1001 }, (_, index) => ({ id: id(index + 1) }));
  let broken = false;
  const indexed = createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (input: any) => {
    const url = new URL(String(input)); seen.push(url);
    const after = url.searchParams.get('id')?.slice(3);
    if (broken && after) return new Response(JSON.stringify({ code: '57014' }), { status: 500 });
    return new Response(JSON.stringify(remote.filter(row => !after || row.id > after).slice(0, 500)));
  } } });
  expect(await readIndexedRemoteJobIds(indexed)).toEqual(remote.map(row => row.id));
  expect(seen).toHaveLength(3);
  expect(seen.every(url => url.searchParams.get('select') === 'id' && url.searchParams.get('ishdasiz_job_work_mode') === 'eq.remote' && url.searchParams.get('is_active') === 'eq.true')).toBe(true);
  broken = true;
  await expect(readIndexedRemoteJobIds(indexed)).rejects.toThrow('Indexed work formats unavailable');
});
