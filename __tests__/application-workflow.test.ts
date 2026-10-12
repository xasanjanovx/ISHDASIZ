/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/account/applications/route';
import { PATCH } from '@/app/api/account/applications/[id]/route';
import { PATCH as seen } from '@/app/api/account/applications/seen/route';
import { AccountError, requireAccount } from '@/lib/auth/account';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = id(1), B = id(2), E = id(3), J = id(4), R = id(5), X = id(6);
let rows: Record<string, any[]>, writes: any[], failWrite: boolean, race: (() => void) | null;
function split(value: string) {
  let depth = 0, start = 0; const parts: string[] = [];
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '(') depth++; if (value[index] === ')') depth--;
    if (value[index] === ',' && depth === 0) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  parts.push(value.slice(start)); return parts;
}
function matches(row: any, expression: string): boolean {
  if (expression.startsWith('and(')) return split(expression.slice(4, -1)).every(part => matches(row, part));
  const [, field, operator, value] = expression.match(/^([a-z_]+)\.(eq|lt|is)\.(.*)$/)!;
  if (operator === 'is') return row?.[field] == null;
  return operator === 'eq' ? String(row?.[field]) === value : row?.[field] < value;
}
function client() {
  return { from: (table: string) => {
    const filters: Array<(row: any) => boolean> = [], orders: Array<{ key: string; ascending: boolean }> = [];
    let body: any, head = false, limit = Infinity, inner = false;
    const query: any = {
      select: (columns: string, options?: any) => { head = options?.head || false; inner = columns.includes('jobs!inner'); return query; },
      eq: (key: string, value: any) => { filters.push(row => row[key] === value); return query; },
      is: (key: string, value: any) => { filters.push(row => value === null ? row[key] == null : row[key] === value); return query; },
      in: (key: string, values: any[]) => { filters.push(row => values.includes(row[key])); return query; },
      or: (expression: string, options?: any) => { filters.push(row => split(expression).some(part => matches(options?.referencedTable ? row[options.referencedTable] : row, part))); return query; },
      order: (key: string, options: any) => { orders.push({ key, ascending: options.ascending }); return query; },
      limit: (value: number) => { limit = value; return query; },
      update: (value: any) => { body = value; return query; },
    };
    const joined = (row: any) => table === 'job_applications' ? { ...row, jobs: rows.jobs.find(job => job.id === row.job_id) || null, resumes: rows.resumes.find(resume => resume.id === row.resume_id) || null } : row;
    const run = async (single = false) => {
      if (body) { writes.push(body); if (failWrite) return { data: null, error: { message: 'Secret SQL' } }; if (race) { const callback = race; race = null; callback(); } }
      const selected = rows[table].filter(row => { const value = joined(row); return (!inner || value.jobs) && filters.every(check => check(value)); });
      if (body) selected.forEach(row => Object.assign(row, body));
      const data = selected.map(joined).sort((left, right) => { for (const order of orders) if (left[order.key] !== right[order.key]) return (left[order.key] < right[order.key] ? -1 : 1) * (order.ascending ? 1 : -1); return 0; }).slice(0, limit);
      return { data: head ? null : structuredClone(single ? data[0] || null : data), error: null, count: selected.length };
    };
    query.maybeSingle = () => run(true); query.then = (resolve: any, reject: any) => run().then(resolve, reject); return query;
  },rpc: (name: string,args: any) => ({ abortSignal: () => (async () => {
    if (name==='ishdasiz_application_seen') {
      expect(args.p_user_id).toBe(B);expect(args.p_session_version).toBe(0);
      if(failWrite)return {data:null,error:{code:'08006',message:'Secret SQL'}};
      const snapshots=args.p_snapshots,owned=snapshots.map((snapshot:any)=>rows.job_applications.find(row=>row.id===snapshot.id&&row.user_id===B));
      if(owned.some((row:any)=>!row))return {data:null,error:{code:'P0002'}};
      if(race){const callback=race;race=null;callback();}
      const seen:string[]=[],changed:string[]=[];
      snapshots.forEach((snapshot:any,index:number)=>{const row=owned[index];if(row.status===snapshot.status&&row.responded_at===snapshot.responded_at){seen.push(row.id);if(row.is_seen_by_job_seeker!==true){writes.push({is_seen_by_job_seeker:true});row.is_seen_by_job_seeker=true;}}else changed.push(row.id);});
      return {data:{seen,changed},error:null};
    }
    expect(name).toBe('ishdasiz_web_application_action');expect(args.p_user_id).toBe(A);expect(args.p_session_version).toBe(0);
    if (failWrite) return { data: null,error: { code: '08006',message: 'Secret SQL' } };
    if (race) { const callback=race;race=null;callback(); }
    const app=rows.job_applications.find(row=>row.id===args.p_application_id),job=rows.jobs.find(row=>row.id===app?.job_id);
    const profile=rows.employer_profiles.find(row=>row.user_id===args.p_user_id);
    const owner=job?.employer_id ? rows.employer_profiles.find(row=>row.id===job.employer_id)?.user_id : job?.user_id || job?.created_by;
    if (!app) return { data: null,error: { code: 'P0002' } };
    if (!profile || owner!==args.p_user_id) return { data: null,error: { code: '42501' } };
    if (args.p_action==='status' && (app.status!==args.p_expected_status || app.responded_at!==args.p_expected_responded_at)) return { data: null,error: { code: '40001' } };
    const patch=args.p_action==='view' ? { viewed_at: app.viewed_at || '2026-10-10T00:00:00Z',status: app.status==='pending'?'reviewed':app.status } : { status: args.p_status,responded_at: '2026-10-10T00:00:00.123457Z',viewed_at: app.viewed_at || '2026-10-10T00:00:00Z',is_seen_by_job_seeker: false,...args.p_details };
    writes.push(patch);Object.assign(app,patch);return { data: structuredClone(app),error: null };
  })() }) };
}
const application = (n = 6, status = 'pending', user = B, job = J) => ({ id: id(n), job_id: job, user_id: user, full_name: 'Candidate', phone: '+998901234567', status, created_at: '2026-10-07T00:00:00.123456Z', responded_at: null, viewed_at: null, is_seen_by_job_seeker: false, resume_id: R });
const auth = (user = A) => (requireAccount as jest.Mock).mockResolvedValue({ client: client(), user: { id: user } });
const get = (query = 'role=employer') => GET(new NextRequest(`http://localhost/api/account/applications?${query}`));
const patch = (body: any, app = X, origin?: string) => PATCH(new NextRequest(`http://localhost/api/account/applications/${app}`, { method: 'PATCH', headers: origin ? { origin } : {}, body: JSON.stringify(body) }), { params: Promise.resolve({ id: app }) });
const mark = (applications: any[]) => seen(new NextRequest('http://localhost/api/account/applications/seen', { method: 'PATCH', body: JSON.stringify({ applications }) }));
const version = (row: any) => ({ id: row.id, status: row.status, responded_at: row.responded_at });
beforeEach(() => {
  jest.clearAllMocks(); writes = []; failWrite = false; race = null;
  rows = { employer_profiles: [{ id: E, user_id: A }], job_seeker_profiles: [{ id: id(7), user_id: B }], jobs: [{ id: J, employer_id: E, user_id: B, created_by: B, title_uz: 'Ish' }], resumes: [{ id: R, user_id: B, status: 'active', skills: ['JS'], experience: [] }], job_applications: [application()] };
  auth();
});
test('unsigned requests, missing roles, cross-origin and forged application IDs cannot mutate', async () => {
  expect((await patch({ action: 'view' }, X, 'https://attacker.example')).status).toBe(403);
  expect((await patch({ action: 'view' }, id(999))).status).toBe(404);
  rows.employer_profiles = []; expect((await get()).status).toBe(403);
  (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401, 'Login')); expect((await get()).status).toBe(401);
  expect(writes).toEqual([]);
});
test('employer ownership prioritizes assigned company, then canonical user, then legacy creator', async () => {
  rows.jobs.push({ id: id(10), employer_id: id(99), user_id: A, created_by: A }, { id: id(11), employer_id: null, user_id: A }, { id: id(12), employer_id: null, user_id: null, created_by: A }, { id: id(13), employer_id: null, user_id: B, created_by: A });
  rows.job_applications.push(...[10, 11, 12, 13].map(n => application(100 + n, 'pending', B, id(n))));
  const data = await (await get()).json(); expect(data.applications.map((row: any) => row.id)).toEqual([id(112), id(111), X]); expect(data.stats.total).toBe(3);
  expect((await patch({ action: 'view' }, id(110))).status).toBe(404); expect(writes).toEqual([]);
});
test('the seeker sees only their own history, including unavailable jobs; no phone fallback or GET writes', async () => {
  auth(B); rows.job_applications.push(application(8, 'accepted', A), application(9, 'rejected', B, id(999)));
  const response = await get('role=job_seeker&user_id=' + A); const data = await response.json();
  expect(data.applications.map((row: any) => row.id)).toEqual([id(9), X]); expect(data.applications[0].jobs).toBeNull(); expect(writes).toEqual([]); expect(response.headers.get('cache-control')).toBe('no-store');
});
test('keyset pages do not lose equal timestamps; exact counts extend beyond 1,000 vacancies', async () => {
  rows.jobs = Array.from({ length: 1205 }, (_, n) => ({ id: id(2000 + n), employer_id: E }));
  rows.job_applications = rows.jobs.map((job, n) => application(4000 + n, 'pending', B, job.id));
  const first = await (await get()).json(); expect(first.applications).toHaveLength(50); expect(first.stats.total).toBe(1205); expect(first.nextCursor).toBe(id(5155));
  rows.job_applications.find(row => row.id === first.nextCursor)!.status = 'accepted';
  const second = await (await get(`role=employer&status=pending&before=${first.nextCursor}`)).json();
  expect(second.applications).toHaveLength(50); expect(second.applications[0].id).toBe(id(5154)); expect(second.stats).toBeNull(); expect(writes).toEqual([]);
});
test('status filters count and include all legacy interview aliases; invalid or foreign cursors fail', async () => {
  rows.job_applications = ['interview', 'invited', 'interviewed', 'interview_set', 'accepted'].map((status, n) => application(20 + n, status));
  const data = await (await get('role=employer&status=interview_set')).json(); expect(data.applications).toHaveLength(4); expect(data.stats.interview_set).toBe(4);
  expect((await get('role=employer&status=invalid')).status).toBe(400); expect((await get(`role=employer&before=${id(999)}`)).status).toBe(400);
});
test.each(['foreign', 'draft'])('employers cannot obtain a %s attached resume or its id', async kind => {
  if (kind === 'foreign') rows.resumes[0].user_id = A; else rows.resumes[0].status = 'draft';
  const data = await (await get()).json(); expect(data.applications[0].resumes).toBeNull(); expect(data.applications[0].resume_id).toBeNull(); expect(data.applications[0]).not.toHaveProperty('user_id'); expect(data.applications[0].jobs).not.toHaveProperty('employer_id');
});
test('opening one pending application marks only that application reviewed', async () => {
  rows.job_applications.push(application(8)); const response = await patch({ action: 'view' });
  expect(response.status).toBe(200); expect((await response.json()).application.status).toBe('reviewed'); expect(rows.job_applications[1].status).toBe('pending'); expect(rows.job_applications[0].is_seen_by_job_seeker).toBe(false);
});
test('opening a decided application preserves its decision and notification version', async () => {
  Object.assign(rows.job_applications[0], { status: 'accepted', responded_at: '2026-10-07T01:02:03.123456Z' });
  expect((await patch({ action: 'view' })).status).toBe(200); expect(rows.job_applications[0].responded_at).toBe('2026-10-07T01:02:03.123456Z');expect(rows.job_applications[0].viewed_at).toBeTruthy();
});
test('status writes preserve microsecond version checks and reject stale decisions', async () => {
  Object.assign(rows.job_applications[0], { status: 'reviewed', responded_at: '2026-10-07T01:02:03.123456Z' });
  expect((await patch({ action: 'status', status: 'accepted', expected: { status: 'reviewed', responded_at: '2026-10-07T01:02:03.123Z' } })).status).toBe(409);
  expect(writes).toEqual([]); expect((await patch({ action: 'status', status: 'hired', expected: version(rows.job_applications[0]) })).status).toBe(200); expect(rows.job_applications[0].status).toBe('hired');
});
test('returning a decision to pending retains a fresh version rather than reopening the original null version', async () => {
  Object.assign(rows.job_applications[0], { status: 'reviewed', responded_at: '2026-10-07T01:02:03.123456Z' });
  expect((await patch({ action: 'status', status: 'pending', expected: version(rows.job_applications[0]) })).status).toBe(200);
  expect(rows.job_applications[0].responded_at).not.toBeNull();
  expect((await patch({ action: 'status', status: 'accepted', expected: { status: 'pending', responded_at: null } })).status).toBe(409);
});
test('a concurrent employer decision is never overwritten by a stale view or status update', async () => {
  race = () => Object.assign(rows.job_applications[0], { status: 'accepted', responded_at: '2026-10-07T02:00:00Z' });
  const response = await patch({ action: 'view' }); expect((await response.json()).application.status).toBe('accepted');
  rows.job_applications[0] = application(); race = () => Object.assign(rows.job_applications[0], { status: 'hired', responded_at: '2026-10-07T03:00:00Z' });
  expect((await patch({ action: 'status', status: 'rejected', expected: version(rows.job_applications[0]) })).status).toBe(409); expect(rows.job_applications[0].status).toBe('hired');
});
test('failed status writes report failure without changing data or leaking SQL', async () => {
  failWrite = true; const response = await patch({ action: 'view' }); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('Secret SQL'); expect(rows.job_applications[0].status).toBe('pending');
});
test('read acknowledgements reject mixed owned and foreign IDs before any write', async () => {
  auth(B); rows.job_applications.push(application(8, 'accepted', A));
  expect((await mark(rows.job_applications.map(version))).status).toBe(404); expect(writes).toEqual([]);
  expect((await mark([version(rows.job_applications[0]), version(rows.job_applications[0])])).status).toBe(400);
});
test('read acknowledgements use the observed decision version, even if it changes during the write', async () => {
  auth(B); rows.job_applications[0].status = 'reviewed'; const snapshot = version(rows.job_applications[0]);
  race = () => Object.assign(rows.job_applications[0], { status: 'accepted', responded_at: '2026-10-07T04:00:00.123456Z' });
  const data = await (await mark([snapshot])).json(); expect(data).toEqual({ seen: [], changed: [X] }); expect(rows.job_applications[0].is_seen_by_job_seeker).toBe(false);
  expect((await (await mark([version(rows.job_applications[0])])).json()).seen).toEqual([X]); expect(rows.job_applications[0].is_seen_by_job_seeker).toBe(true);
});


test('a vacancy transfer after preflight prevents a former employer from changing an application',async()=>{
 rows.employer_profiles.push({id:id(99),user_id:B});race=()=>{rows.jobs[0].employer_id=id(99);};const response=await patch({action:'status',status:'accepted',expected:version(rows.job_applications[0])});expect(response.status).toBe(403);expect(rows.job_applications[0].status).toBe('pending');expect(writes).toEqual([]);
});
test.each([{}, {interview_date:'bad'}, {interview_date:'2026-02-30T10:00:00+05:00'}, {interview_date:'2026-10-12T10:00:00+05:00',user_id:B}])('web interview rejects invalid details before writing (%j)',async details=>{
 expect((await patch({action:'status',status:'interview_set',expected:version(rows.job_applications[0]),details})).status).toBe(400);expect(writes).toEqual([]);
});
test('web interview persists the fixed Uzbekistan timestamp, address and candidate message',async()=>{
 const details={interview_date:'2026-10-12T10:30:00+05:00',interview_address:' Office ',employer_message:' Welcome '};const response=await patch({action:'status',status:'interview_set',expected:version(rows.job_applications[0]),details});expect(response.status).toBe(200);const saved=(await response.json()).application;expect(saved.interview_date).toBe(details.interview_date);expect(saved.interview_address).toBe('Office');expect(saved.employer_message).toBe('Welcome');expect(saved).not.toHaveProperty('user_id');
});
