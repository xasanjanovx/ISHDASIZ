/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/account/applications/route';
import { GET as resumes } from '@/app/api/account/applications/resumes/route';
import { AccountError, requireAccount } from '@/lib/auth/account';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';
const R = '10000000-0000-4000-8000-000000000001', J = '20000000-0000-4000-8000-000000000001';
let rows: Record<string, any[]>, inserts: any[], insertError: any, readError: any;
function client() {
  return { from: (table: string) => {
    const filters: ((row: any) => boolean)[] = []; let fields = '*', body: any, offset = 0, size = Infinity;
    const query: any = {
      select: (columns: string) => { fields = columns; return query; },
      eq: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, values: any[]) => { filters.push(row=>values.includes(row[key]));return query;},
      order: () => query,
      range: (start: number, end: number) => { offset = start; size = end - start + 1; return query; },
      limit: (limit: number) => { size = limit; return query; },
      insert: (value: any) => { body = value; return query; },
    };
    const run = async (single = false) => {
      if (readError && !body) return { data: null, error: readError };
      if (body) { inserts.push(body); if (insertError) return { data: null, error: insertError }; rows[table].push({ id: 'new-application', created_at: '2026-10-07', ...body }); }
      const matches = (rows[table] || []).filter(row => filters.every(check => check(row))).slice(offset, offset + size);
      const data = matches.map(row => fields === '*' ? row : Object.fromEntries(fields.split(',').map(key => [key.trim().replace(/\(.*/,''), row[key.trim().replace(/\(.*/,'')]])));
      return { data: single ? data[0] || null : data, error: null };
    };
    query.maybeSingle = () => run(true); query.single = () => run(true); query.then = (resolve: any, reject: any) => run().then(resolve, reject);
    return query;
  },rpc:async(name:string,args:any)=>{expect(name).toBe('ishdasiz_submit_application');inserts.push(args);return {data:insertError?null:{id:J,status:'pending',created_at:'2026-10-09T00:00:00Z'},error:insertError};} };
}
const body = () => ({ job_id: J, resume_id: R, phone: '90 123 45 67', message: '  Cover letter  ' });
const request = (payload: any = body(), origin?: string) => new NextRequest('http://localhost/api/account/applications', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(payload) });
beforeEach(() => {
  jest.clearAllMocks(); inserts = []; insertError = null; readError = null;
  rows = { job_seeker_profiles: [{ id: 'seeker-profile', user_id: A }], employer_profiles: [{ id: 'other-company', user_id: B }], jobs: [{ id: J, is_active: true, user_id: B }], resumes: [{ id: R, user_id: A, full_name: 'Own name', title: 'My resume', status: 'active', experience_years: 2 }], job_applications: [] };
  rows.users=[{id:A,closed_at:null},{id:B,closed_at:null}];
  (requireAccount as jest.Mock).mockResolvedValue({ client: client(), user: { id: A, phone: '+998901234567' } });
});
test('unsigned and cross-origin writes fail without inserting', async () => {
  expect((await POST(request(body(), 'https://attacker.example'))).status).toBe(403);
  (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401, 'Login required'));
  expect((await POST(request())).status).toBe(401); expect(inserts).toEqual([]);
});
test('the server chooses identity, name and pending status despite forged fields', async () => {
  const response = await POST(request({ ...body(), user_id: B, full_name: 'Forged name', status: 'hired' }));
  expect(response.status).toBe(201);
  expect(inserts[0]).toEqual({p_job_id:J,p_resume_id:R,p_user_id:A,p_session_version:0,p_phone:'+998901234567',p_message:'Cover letter'});
  expect((await response.json()).application).not.toHaveProperty('phone');
});
test.each(['foreign', 'draft'])('a %s resume cannot be submitted', async kind => {
  if (kind === 'foreign') rows.resumes[0].user_id = B; else rows.resumes[0].status = 'draft';
  expect((await POST(request())).status).toBe(404); expect(inserts).toEqual([]);
});
test('inactive vacancies and missing seeker profiles are rejected', async () => {
  rows.jobs[0].is_active = false; expect((await POST(request())).status).toBe(404);
  rows.job_seeker_profiles = []; expect((await POST(request())).status).toBe(403);
  expect(inserts).toEqual([]);
});
test('a user cannot apply to their own company vacancy created by an administrator', async () => {
  rows.employer_profiles.push({ id: 'own-company', user_id: A }); rows.jobs[0].employer_id = 'own-company';
  expect((await POST(request())).status).toBe(409); expect(inserts).toEqual([]);
});
test('existing and concurrently inserted duplicates both report conflict', async () => {
  rows.job_applications.push({ id: 'existing', user_id: A, job_id: J });
  expect((await POST(request())).status).toBe(409); expect(inserts).toEqual([]);
  rows.job_applications = []; insertError = { code: '23505' };
  expect((await POST(request())).status).toBe(409);
});
test.each([{ phone: 'bad' }, { message: 'x'.repeat(4001) }, { resume_id: 'not-a-uuid' }, { message: { forged: true } }])('invalid input fails before insertion (%j)', async invalid => {
  expect((await POST(request({ ...body(), ...invalid }))).status).toBe(400); expect(inserts).toEqual([]);
});
test('database failures do not pretend success or expose SQL details', async () => {
  readError = { message: 'Secret SQL details' };
  const response = await POST(request());
  expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('Secret SQL details');
});
test.each([{resume_id:null},{resume_id:undefined}])('a resume is mandatory even with a phone and message (%j)',async invalid=>{
 expect((await POST(request({...body(),...invalid}))).status).toBe(400);expect(inserts).toEqual([]);
});
test.each([{status:'draft'},{status:'filled'},{source_status:'removed_at_source'},{is_imported:true}])('unavailable vacancies reject applications even if active is true (%j)',async values=>{
 Object.assign(rows.jobs[0],values);expect((await POST(request())).status).toBe(404);expect(inserts).toEqual([]);
});
test('a closed assigned employer hides the vacancy despite a different legacy creator',async()=>{
 rows.jobs[0].employer_id='other-company';rows.jobs[0].user_id=A;rows.jobs[0].employer_profiles={user_id:B};rows.users[1].closed_at='2026-10-07T00:00:00Z';
 expect((await POST(request())).status).toBe(404);expect(inserts).toEqual([]);
});
test('resume choices contain only owned active rows and page beyond the first 100', async () => {
  rows.resumes = Array.from({ length: 205 }, (_, i) => ({ id: `resume-${i}`, user_id: A, title: `Resume ${i}`, status: 'active', full_name: 'Private name' }));
  rows.resumes.push({ id: 'foreign', user_id: B, status: 'active' }, { id: 'draft', user_id: A, status: 'draft' });
  const response = await resumes(new NextRequest('http://localhost/api/account/applications/resumes?user_id=other-user'));
  const data = await response.json(); expect(data.resumes).toHaveLength(205);
  expect(data.resumes[0]).not.toHaveProperty('full_name'); expect(response.headers.get('cache-control')).toBe('no-store');
});
test.each([['42501',401],['P0002',404],['40001',409],['08006',503]])('transactional rejection after a successful preflight reports %s without false success',async(code,status)=>{
 insertError={code,message:'Private SQL detail'};const response=await POST(request());expect(response.status).toBe(status);expect(JSON.stringify(await response.json())).not.toContain('Private SQL detail');expect(inserts).toHaveLength(1);
});
