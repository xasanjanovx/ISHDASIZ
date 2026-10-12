/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as list, POST } from '@/app/api/account/resumes/route';
import { GET, PUT, PATCH, DELETE } from '@/app/api/account/resumes/[id]/route';
import { GET as prefill } from '@/app/api/account/resumes/prefill/route';
import { AccountError, requireAccount } from '@/lib/auth/account';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = id(1), B = id(2), R = id(3), C = id(4), NEW = id(5), VERSION = '2026-10-07T00:00:00.123456Z';
let rows: Record<string, any[]>, writes: any[], failure: boolean, race: (() => void) | null, missingFeatures: boolean, textLanguages: boolean;
function client() {
  return { from: (table: string) => {
    let fields = '', body: any, insert = false, limit = Infinity, cursor: string | null = null;
    const checks: Array<(row: any) => boolean> = [], orders: Array<{ key: string; ascending: boolean }> = [];
    const query: any = {
      select: (value: string) => { fields = value; return query; },
      eq: (key: string, value: any) => { checks.push(row => row[key] === value); return query; },
      neq: (key: string, value: any) => { checks.push(row => row[key] !== value); return query; },
      is: (key: string, value: any) => { checks.push(row => value === null ? row[key] == null : row[key] === value); return query; },
      limit: (value: number) => { limit = value; return query; },
      order: (key: string, options: any) => { orders.push({ key, ascending: options.ascending }); return query; },
      or: (expression: string) => { cursor = expression; return query; },
      update: (value: any) => { body = value; return query; },
      insert: (value: any) => { body = value; insert = true; return query; },
    };
    const run = async (single = false) => {
      if (textLanguages && fields === 'languages::jsonb') return { data: null, error: { code: '42846', message: 'cannot cast type text[] to jsonb' } };
      if (missingFeatures && table === 'resumes' && fields.includes('found_job')) return { data: null, error: { code: '42703', message: 'column resumes.found_job does not exist' } };
      if (body) { writes.push({ table, body, insert }); if (failure) return { data: null, error: { message: 'Secret SQL' } }; if (race) { const callback = race; race = null; callback(); } }
      if (insert) { if (rows[table].some(row => row.id === body.id)) return { data: null, error: { code: '23505' } }; rows[table].push({ ...body, created_at: VERSION, updated_at: VERSION }); checks.push(row => row.id === body.id); }
      let selected = rows[table].filter(row => checks.every(check => check(row)));
      if (cursor) {
        const parsed = cursor.match(/^created_at.lt.(.*),and\(created_at.eq.(.*),id.lt.(.*)\)$/)!;
        selected = selected.filter(row => row.created_at < parsed[1] || row.created_at === parsed[2] && row.id < parsed[3]);
      }
      if (body && !insert) selected.forEach(row => Object.assign(row, body));
      selected.sort((first, second) => { for (const { key, ascending } of orders) if (first[key] !== second[key]) return (first[key] < second[key] ? -1 : 1) * (ascending ? 1 : -1); return 0; });
      const data = selected.slice(0, limit).map(row => Object.fromEntries(fields.replace(/regions\([^)]*\)|districts\([^)]*\)/g, '').split(',').filter(Boolean).map(key => [key, row[key] ?? null])));
      return { data: structuredClone(single ? data[0] || null : data), error: null };
    };
    query.single = () => run(true); query.maybeSingle = () => run(true); query.then = (resolve: any, reject: any) => run().then(resolve, reject); return query;
  } };
}
const data = () => ({ title: 'Developer', full_name: 'Candidate', phone: '90 123 45 67', birth_date: '2000-01-01', region_id: 22, district_id: 100, category_id: C, about: 'Skills and experience', experience: 'no_experience', education_level: 'secondary', gender: 'any', employment_type: 'full_time', skills: ['JS'], experience_details: [], education: [], languages: [], expected_salary_min: 0, expected_salary_max: 5000000, is_public: true, status: 'active' });
const req = (method: string, body?: any, origin?: string) => new NextRequest('http://localhost/api/account/resumes', { method, ...(body ? { body: JSON.stringify(body) } : {}), ...(origin ? { headers: { origin } } : {}) });
const context = (resume = R) => ({ params: Promise.resolve({ id: resume }) });
const post = (body: any = data(), request_id = NEW) => POST(req('POST', { ...body, request_id }));
const edit = (body: any = data()) => PUT(req('PUT', { ...body, expected_updated_at: VERSION }), context());
const action = (kind: string, extra = {}) => PATCH(req('PATCH', { action: kind, expected_updated_at: VERSION, ...extra }), context());
beforeEach(() => {
  jest.clearAllMocks(); writes = []; failure = false; race = null; missingFeatures = false; textLanguages = false;
  rows = { job_seeker_profiles: [{ id: id(9), user_id: A, full_name: 'Own profile', birth_date: '2000-01-01', phone: 'old-phone' }], resumes: [{ ...data(), id: R, user_id: A, phone: '+998901234567', created_at: VERSION, updated_at: VERSION }], regions: [{ id: 22 }], districts: [{ id: 100, region_id: 22, name_uz: 'Tuman' }], categories: [{ id: C }] };
  (requireAccount as jest.Mock).mockResolvedValue({ client: client(), user: { id: A, phone: '+998909999999' } });
});
test('guest, wrong role and cross-origin requests fail without a write', async () => {
  expect((await PUT(req('PUT', data(), 'https://attacker.example'), context())).status).toBe(403);
  rows.job_seeker_profiles = []; expect((await post()).status).toBe(403);
  (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401, 'Login')); expect((await GET(req('GET'), context())).status).toBe(401); expect(writes).toEqual([]);
});
test('reading, editing, archiving and restoring a foreign resume are rejected', async () => {
  rows.resumes[0].user_id = B;
  for (const handler of [GET, PUT, DELETE, PATCH]) expect((await handler(req(handler === GET ? 'GET' : 'PATCH', handler === GET ? undefined : { ...data(), action: 'restore', expected_updated_at: VERSION }), context())).status).toBe(404);
  expect(writes).toEqual([]);
});
test('the owner list pages through equal timestamps without exposing other users or archived rows', async () => {
  rows.resumes = Array.from({ length: 105 }, (_, index) => ({ ...data(), id: id(100 + index), user_id: A, created_at: VERSION, updated_at: VERSION }));
  rows.resumes.push({ ...rows.resumes[0], id: id(999), user_id: B }, { ...rows.resumes[0], id: id(998), status: 'archived' });
  const first = await (await list(new NextRequest('http://localhost/api/account/resumes?user_id=' + B))).json(); expect(first.resumes).toHaveLength(50); expect(first.resumes[0].id).toBe(id(204)); expect(first.nextCursor).toBe(id(155));
  const second = await (await list(new NextRequest(`http://localhost/api/account/resumes?before=${first.nextCursor}`))).json(); expect(second.resumes[0].id).toBe(id(154)); expect(second.resumes).toHaveLength(50); expect(writes).toEqual([]);
});
test('creation chooses the signed owner, whitelists fields, validates references and normalizes phone', async () => {
  const response = await post({ ...data(), user_id: B, views: 9999, found_job: true, created_at: '1900', city: 'Forged city' }); expect(response.status).toBe(201);
  expect(writes[0].body).toMatchObject({ id: NEW, user_id: A, phone: '+998901234567', city: 'Tuman', found_job: false }); expect(writes[0].body).not.toHaveProperty('views'); expect(writes[0].body).not.toHaveProperty('created_at'); expect((await response.json()).resume).not.toHaveProperty('user_id');
});
test('empty drafts are allowed and cannot become public', async () => {
  const response = await post({ status: 'draft', is_public: true }); expect(response.status).toBe(201); expect(writes[0].body).toMatchObject({ status: 'draft', is_public: false, category_id: null, phone: null });
});
test.each([{ expected_salary_min: 6000000 }, { expected_salary_max: -1 }, { birth_date: '2000-02-30' }, { birth_date: '2999-01-01' }, { region_id: 9 }, { district_id: 999 }, { category_id: id(999) }, { phone: 'bad' }, { title: '' }, { skills: 'JS' }, { skills: ['x'.repeat(101)] }, { experience_details: [{ company: 'Company', position: 'Role', start_date: '2025', end_date: '2024' }] }])('invalid values fail before a write (%j)', async invalid => {
  expect((await post({ ...data(), ...invalid })).status).toBe(400); expect(writes).toEqual([]);
});
test('work years and current education are preserved, and nested fields are whitelisted', async () => {
  const response = await post({ ...data(), experience: '3_years', education_level: 'higher', experience_details: [{ company: 'Company', position: 'Role', start_date: '2023', end_date: 'current', user_id: B }], education: [{ institution: 'University', field: 'IT', start_year: '2022', end_year: 'current' }], languages: [{ name: 'english', level: 'advanced', secret: true }] });
  expect(response.status).toBe(201); expect(writes[0].body.experience_details[0]).toMatchObject({ start_date: '2023', end_date: '', is_current: true }); expect(writes[0].body.experience_details[0]).not.toHaveProperty('user_id'); expect(writes[0].body.education[0]).toMatchObject({ start_year: 2022, end_year: null }); expect(writes[0].body.languages).toEqual([{ name: 'english', level: 'advanced' }]);
});
test('lost creation responses can be retried without duplicate rows, including JSONB key order', async () => {
  const payload = { ...data(), languages: [{ name: 'english', level: 'advanced' }] };
  expect((await post(payload)).status).toBe(201); rows.resumes.find(row => row.id === NEW)!.languages = [{ level: 'advanced', name: 'english' }];
  expect((await post(payload)).status).toBe(201); expect(writes).toHaveLength(1);
  expect((await post({ ...payload, title: 'Different draft' })).status).toBe(409); expect(writes).toHaveLength(1);
});
test('legacy text[] languages keep their levels, return normal objects and support retries', async () => {
  textLanguages = true; const payload = { ...data(), languages: [{ name: 'english', level: 'advanced' }] };
  const response = await post(payload); expect(response.status).toBe(201); expect(writes[0].body.languages).toEqual(['{"name":"english","level":"advanced"}']);
  expect((await response.json()).resume.languages).toEqual([{ name: 'english', level: 'advanced' }]); expect((await post(payload)).status).toBe(201); expect(writes).toHaveLength(1);
});
test('concurrent identical creates recover a legacy text[] row inserted by the first request', async () => {
  textLanguages = true;
  race = () => { rows.resumes.push({ ...writes.at(-1).body, created_at: VERSION, updated_at: VERSION }); };
  const response = await post({ ...data(), languages: [{ name: 'english', level: 'advanced' }] });
  expect(response.status).toBe(201); expect((await response.json()).resume.languages).toEqual([{ name: 'english', level: 'advanced' }]);
  expect(rows.resumes.filter(row => row.id === NEW)).toHaveLength(1);
});
test('edits compare the full microsecond version and reject concurrent writes', async () => {
  expect((await PUT(req('PUT', { ...data(), expected_updated_at: '2026-10-07T00:00:00.123Z' }), context())).status).toBe(409); expect(writes).toEqual([]);
  race = () => { rows.resumes[0].updated_at = '2026-10-07T01:00:00Z'; rows.resumes[0].title = 'Newer edit'; };
  expect((await edit()).status).toBe(409); expect(rows.resumes[0].title).toBe('Newer edit');
});
test('failed writes do not report success or leak SQL', async () => {
  failure = true; const response = await edit(); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('Secret SQL'); expect(rows.resumes[0].updated_at).toBe(VERSION);
});
test('archive preserves the row, and restore keeps it private as a draft', async () => {
  const response = await DELETE(req('DELETE', { expected_updated_at: VERSION }), context()); expect(response.status).toBe(200); expect(rows.resumes).toHaveLength(1); expect(rows.resumes[0]).toMatchObject({ status: 'archived', is_public: false });
  const restored = await PATCH(req('PATCH', { action: 'restore', expected_updated_at: rows.resumes[0].updated_at }), context()); expect(restored.status).toBe(200); expect(rows.resumes[0]).toMatchObject({ status: 'draft', is_public: false });
});
test('found-job and resume-search actions update visibility; editing cannot publish a found-job resume accidentally', async () => {
  expect((await action('found_job')).status).toBe(200); expect(rows.resumes[0]).toMatchObject({ found_job: true, is_public: false });
  const result = await PUT(req('PUT', { ...data(), expected_updated_at: rows.resumes[0].updated_at }), context()); expect(result.status).toBe(200); expect(rows.resumes[0].is_public).toBe(false);
  expect((await PATCH(req('PATCH', { action: 'resume_search', expected_updated_at: rows.resumes[0].updated_at }), context())).status).toBe(200); expect(rows.resumes[0]).toMatchObject({ found_job: false, is_public: true });
});
test('older schemas still allow list/create/edit/archive/restore and explicitly reject unavailable found-job actions', async () => {
  missingFeatures = true; expect((await list(req('GET'))).status).toBe(200); expect((await post()).status).toBe(201); expect(writes[0].body).not.toHaveProperty('found_job');
  expect((await edit()).status).toBe(200); rows.resumes[0].updated_at = VERSION;
  expect((await action('found_job')).status).toBe(409);
  expect((await DELETE(req('DELETE', { expected_updated_at: VERSION }), context())).status).toBe(200);
  expect((await PATCH(req('PATCH', { action: 'restore', expected_updated_at: rows.resumes[0].updated_at }), context())).status).toBe(200);
  expect(writes.every(write => !('found_job' in write.body))).toBe(true);
});
test('prefill returns only the signed seeker profile and uses the verified account phone', async () => {
  const response = await prefill(new NextRequest('http://localhost/api/account/resumes/prefill?user_id=' + B)); const payload = await response.json(); expect(payload.profile.full_name).toBe('Own profile'); expect(payload.profile.phone).toBe('+998909999999'); expect(payload.profile).not.toHaveProperty('user_id');
});
