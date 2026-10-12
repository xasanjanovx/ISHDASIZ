/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/resumes/route';
import { getAuthClient } from '@/lib/auth/server';
import { catalogFilters, searchResumes } from '@/lib/resume-catalog';
jest.mock('@/lib/auth/server', () => ({ getAuthClient: jest.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const date = '2026-10-07T00:00:00.123456Z';
let rows: any[], rpcError: any, fallbackError: any, rpcRows: any[], calls: any[], rpcCall: jest.Mock;
function client() {
  return {
    rpc: rpcCall,
    from: (table: string) => {
      const filters: Array<(row: any) => boolean> = [];
      let size = Infinity, selected = '';
      const query: any = {
        select: (fields: string) => { selected = fields; return query; },
        eq: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
        in: (key: string, values: any[]) => { filters.push(row => values.includes(row[key])); return query; },
        or: (expression: string) => {
          const cursor = expression.match(/^created_at.lt.(.*),and\(created_at.eq.(.*),id.lt.(.*)\)$/);
          if (cursor) filters.push(row => row.created_at < cursor[1] || row.created_at === cursor[2] && row.id < cursor[3]);
          else {
            const salary = expression.match(/^(expected_salary_(?:min|max)).is.null,\1.(gte|lte).(\d+)$/)!;
            filters.push(row => row[salary[1]] == null || (salary[2] === 'gte' ? row[salary[1]] >= Number(salary[3]) : row[salary[1]] <= Number(salary[3])));
          }
          return query;
        },
        order: () => query, limit: (value: number) => { size = value; return query; }, abortSignal: () => query,
        then: (resolve: any, reject: any) => {
          calls.push({ table, selected, size });
          const data = rows.filter(row => filters.every(check => check(row))).sort((a, b) => a.created_at === b.created_at ? b.id.localeCompare(a.id) : b.created_at.localeCompare(a.created_at)).slice(0, size);
          return Promise.resolve({ data, error: fallbackError }).then(resolve, reject);
        },
      };
      return query;
    },
  } as any;
}
const filters = (query = '') => catalogFilters(new URLSearchParams(query));
const row = (n: number, extra = {}) => ({ id: id(n), created_at: date, title: 'Developer', full_name: 'Candidate', is_public: true, status: 'active', ishdasiz_resume_available: true, skills: [], region_id: 22, district_id: 100, ...extra });
const get = (query = '') => GET(new NextRequest(`http://localhost/api/resumes?${query}`));
beforeEach(() => {
  rows = []; calls = []; rpcRows = []; fallbackError = null;
  rpcError = { code: 'PGRST202', message: 'Could not find public.ishdasiz_public_resume_search' };
  rpcCall = jest.fn(() => { const result: any = Promise.resolve({ data: rpcRows, error: rpcError }); result.abortSignal = () => result; return result; });
  (getAuthClient as jest.Mock).mockImplementation(client);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test.each(['category=bad', 'region=0', 'district=1.5', 'experience=unknown', 'gender=unknown', 'salary=5-2', 'salary=0-20000001', 'before=malformed', `q=${'x'.repeat(151)}`])('rejects invalid public parameters before database access: %s', async query => {
  const response = await get(query); expect(response.status).toBe(400); expect(getAuthClient).not.toHaveBeenCalled();
});
test('fallback scans beyond 200, searches skills without case sensitivity, strips private fields and keeps direct region names', async () => {
  rows = Array.from({ length: 300 }, (_, n) => row(300 - n, { skills: n === 250 ? ['React Native'] : [], phone: 'PRIVATE', birth_date: 'PRIVATE', user_id: 'PRIVATE', about: 'PRIVATE', regions: { name_ru: 'Ташкент', name_uz: 'Toshkent', secret: 'PRIVATE' } }));
  const response = await get('q=react'); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json(); expect(body.resumes.map((r: any) => r.id)).toEqual([id(50)]); expect(body.nextCursor).toBeNull();
  expect(JSON.stringify(body)).not.toContain('PRIVATE'); expect(body.resumes[0].regions).toEqual({ name_ru: 'Ташкент', name_uz: 'Toshkent' });
  expect(calls[0].selected).not.toContain('phone'); expect(calls[0].selected).not.toContain('birth_date'); expect(calls[0].selected).not.toContain('user_id');
});
test('empty scan batches have a continuation rather than a false final empty result', async () => {
  rows = Array.from({ length: 1205 }, (_, n) => row(1205 - n, { skills: n === 1150 ? ['RareSkill'] : [] }));
  let page = await searchResumes(client(), filters('q=rareskill'));
  expect(page.resumes).toEqual([]); expect(page.nextCursor).toBeTruthy();
  page = await searchResumes(client(), filters(`q=rareskill&before=${page.nextCursor}`)); expect(page.resumes).toEqual([]); expect(page.nextCursor).toBeTruthy();
  page = await searchResumes(client(), filters(`q=rareskill&before=${page.nextCursor}`)); expect(page.resumes.map(row => row.id)).toEqual([id(55)]); expect(page.nextCursor).toBeNull();
});
test('equal timestamps and multiple matches in a scanned batch are paged without losing or duplicating rows', async () => {
  rows = Array.from({ length: 75 }, (_, n) => row(n + 1, { skills: ['JS'] }));
  let before = '', all: string[] = [];
  do { const page = await searchResumes(client(), filters(`q=js${before ? `&before=${before}` : ''}`)); all.push(...page.resumes.map(row => row.id)); before = page.nextCursor || ''; } while (before);
  expect(all).toHaveLength(75); expect(new Set(all).size).toBe(75); expect(all[0]).toBe(id(75)); expect(all.at(-1)).toBe(id(1));
});
test('visibility, both location filters, legacy experience and open salary endpoints are applied before pagination', async () => {
  rows = [row(1, { skills: ['JS'], experience: '3_years', expected_salary_min: 4000000, expected_salary_max: null }), row(2, { experience: '3', expected_salary_max: 5000000 }),
    row(3, { is_public: false }), row(4, { status: 'draft' }), row(5, { status: 'archived' }), row(6, { region_id: 9, experience: '3', expected_salary_max: 5000000 }), row(7, { experience: '3', expected_salary_min: 6000000, expected_salary_max: 9000000 })];
  const page = await searchResumes(client(), filters('region=22&district=100&experience=3_years&salary=3000000-5000000'));
  expect(page.resumes.map(row => row.id)).toEqual([id(2), id(1)]);
});
test('SQL search passes literal special characters as an RPC parameter and projects even unexpected extra fields away', async () => {
  rpcError = null; rpcRows = Array.from({ length: 25 }, (_, n) => ({ card: row(25 - n, { about: 'PRIVATE', phone: 'PRIVATE', skills: '["C++"]' }) }));
  const response = await get('q=C%2B%2B%2C%25%28test%29'); const body = await response.json();
  expect(body.resumes).toHaveLength(24); expect(body.nextCursor).toBeTruthy(); expect(JSON.stringify(body)).not.toContain('PRIVATE');
  expect(rpcCall.mock.calls[0][1]).toMatchObject({ p_query: 'C++,%(test)', p_page_size: 24 }); expect(calls).toEqual([]); expect(body.resumes[0].skills).toEqual(['C++']);
});
test('RPC failures and denied access do not silently fall back or expose database diagnostics', async () => {
  rpcError = { code: '42501', message: 'PRIVATE database credentials' }; const response = await get(); expect(response.status).toBe(503); expect(calls).toEqual([]); expect(JSON.stringify(await response.json())).not.toContain('PRIVATE');
});
test('a fallback failure returns an error rather than an empty catalog', async () => {
  fallbackError = { message: 'PRIVATE SQL' }; const response = await get(); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('PRIVATE');
});
test('fallback requires database-confirmed public availability before paging and does not expose that internal field', async () => {
  rows = [row(1), row(2, { found_job: true, ishdasiz_resume_available: false }), row(3, { ishdasiz_resume_available: false })];
  const response = await get(); const body = await response.json();
  expect(body.resumes.map((r: any) => r.id)).toEqual([id(1)]);
  expect(body.resumes[0]).not.toHaveProperty('ishdasiz_resume_available');
});
