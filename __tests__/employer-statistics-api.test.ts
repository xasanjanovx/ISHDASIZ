/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GET } from '@/app/api/account/vacancies/stats/route';
import { requireAccount, AccountError } from '@/lib/auth/account';
import { employerJobScope } from '@/lib/account-jobs';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
const A = '00000000-0000-4000-8000-000000000001', E = '10000000-0000-4000-8000-000000000001';
const id = (n: number) => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
const date = '2026-10-09T00:00:00.123456Z';
let requests: { url: URL; method: string }[], failure: string, profile: boolean, foreign: boolean;
const request = (query = '') => new NextRequest('http://localhost/api/account/vacancies/stats' + query);
beforeEach(() => {
  requests = []; failure = ''; profile = true; foreign = false;
  const client = createClient('https://example.supabase.co', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input: any, init: any) => {
      const url = new URL(String(input)), table = url.pathname.split('/').at(-1), method = init.method;
      requests.push({ url, method });
      const fields = url.searchParams.get('select') || '';
      if (failure === table || failure === 'views' && fields === 'id,views_count')
        return new Response(JSON.stringify({ code: '08006', message: 'Private database failure' }), { status: 500 });
      if (table === 'employer_profiles') return new Response(JSON.stringify(profile ? { id: E } : null));
      if (method === 'HEAD') return new Response(null, { headers: failure === 'missing-count' ? {} : { 'Content-Range': `0-0/${table === 'job_applications' ? 2500 : url.searchParams.has('ishdasiz_job_available') ? 1500 : 2001}` } });
      if (table === 'jobs') {
        if (url.searchParams.has('id')) return new Response(JSON.stringify(foreign ? null : { id: id(25), created_at: date }));
        if (fields === 'id,views_count') {
          const start = Number(url.searchParams.get('offset') || 0);
          return new Response(JSON.stringify(Array.from({ length: Math.max(0, Math.min(500, 2001 - start)) }, (_, n) => ({ id: id(start + n + 1), views_count: 2 }))));
        }
        return new Response(JSON.stringify(Array.from({ length: 26 }, (_, n) => ({ id: id(n + 1), title_ru: 'Работа', title_uz: 'Ish', created_at: date, views_count: 7, ishdasiz_job_available: n === 0, contact_phone: 'Private contact', created_by: A }))));
      }
      if (table === 'job_applications') {
        const after = url.searchParams.get('id'), start = after ? Number(after.split('-').at(-1)) : 0;
        if (failure === 'app-second' && start > 0) return new Response(JSON.stringify({ message: 'Private partial read failure' }), { status: 500 });
        return new Response(JSON.stringify(Array.from({ length: Math.max(0, Math.min(500, 1205 - start)) }, (_, n) => ({ id: id(start + n + 1), job_id: id(1), full_name: 'Private applicant', phone: 'Private phone' }))));
      }
      throw new Error('Unexpected query');
    } },
  });
  (requireAccount as jest.Mock).mockResolvedValue({ user: { id: A }, client });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('guests, revoked accounts and missing employer profiles cannot read statistics', async () => {
  (requireAccount as jest.Mock).mockRejectedValueOnce(new AccountError(401, 'Sign in'));
  expect((await GET(request())).status).toBe(401); expect(requests).toHaveLength(0);
  profile = false; expect((await GET(request())).status).toBe(403); expect(requests.every(call => call.url.pathname.endsWith('employer_profiles'))).toBe(true);
});

test('totals cover more than 2000 jobs and 1205 applications; private fields never reach the browser', async () => {
  const response = await GET(request('?user_id=forged&employer_id=forged')), body = await response.json();
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(body.stats).toEqual({ items: 2001, active: 1500, views: 4002, applications: 2500 });
  expect(body.jobs).toHaveLength(25); expect(body.nextCursor).toBe(id(25));
  expect(body.jobs[0]).toEqual({ id: id(1), title_ru: 'Работа', title_uz: 'Ish', created_at: date, available: true, views: 7, applications: 1205 });
  expect(JSON.stringify(body)).not.toContain('Private'); expect(body.jobs[1].available).toBe(false);
  const appPages = requests.filter(call => call.url.pathname.endsWith('job_applications') && call.method !== 'HEAD');
  expect(appPages.map(call => call.url.searchParams.get('id'))).toEqual([null, 'gt.' + id(500), 'gt.' + id(1000)]);
  expect(appPages.every(call => call.url.searchParams.get('limit') === '500' && call.url.searchParams.get('select') === 'id,job_id,jobs!inner(id)')).toBe(true);
  expect(requests.filter(call => call.url.searchParams.get('select') === 'id,views_count').map(call => call.url.searchParams.get('offset'))).toEqual(['0', '500', '1000', '1500', '2000']);
  for (const call of requests) {
    const table = call.url.pathname.split('/').at(-1);
    if (table === 'jobs') expect(call.url.searchParams.get('or')).toContain(employerJobScope(A, E));
    if (table === 'job_applications') expect(call.url.searchParams.get('jobs.or')).toBe('(' + employerJobScope(A, E) + ')');
  }
  expect(requests.find(call => call.url.searchParams.has('ishdasiz_job_available'))?.url.searchParams.get('ishdasiz_job_available')).toBe('eq.true');
});

test('continuation checks cursor ownership and preserves full timestamp/ID ordering without recalculating totals', async () => {
  const response = await GET(request('?before=' + id(25))), body = await response.json();
  expect(response.status).toBe(200); expect(body.stats).toBeNull(); expect(requests.some(call => call.method === 'HEAD')).toBe(false);
  const jobs = requests.filter(call => call.url.pathname.endsWith('jobs'));
  expect(jobs[0].url.searchParams.get('id')).toBe('eq.' + id(25));
  expect(jobs[1].url.searchParams.get('or')).toContain(`and(created_at.eq.${date},id.lt.${id(25)})`);
  expect(jobs[1].url.searchParams.get('order')).toBe('created_at.desc,id.desc'); expect(jobs[1].url.searchParams.get('limit')).toBe('26');
});

test('invalid or foreign cursor cannot bypass ownership or start aggregate reads', async () => {
  expect((await GET(request('?before=forged'))).status).toBe(404); expect(requests).toHaveLength(1);
  requests = []; foreign = true; expect((await GET(request('?before=' + id(25)))).status).toBe(404); expect(requests).toHaveLength(2);
});

test.each(['jobs', 'job_applications', 'views', 'missing-count', 'app-second'])('a failed %s read fails the entire response instead of inventing zero counts', async table => {
  failure = table; const response = await GET(request()); expect(response.status).toBe(503);
  const body = await response.json(); expect(JSON.stringify(body)).not.toContain('Private'); expect(body).not.toHaveProperty('stats');
});
