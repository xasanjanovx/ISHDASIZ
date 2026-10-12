/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/account/profile/route';
import { GET as stats } from '@/app/api/account/profile/stats/route';
import { AccountError, requireAccount } from '@/lib/auth/account';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A = id(1), B = id(2), P = id(3), Q = id(4), VERSION = '2026-10-07T00:00:00.123456Z';
let rows: Record<string, any[]>, writes: any[], calls: any[], failure: string, race: (() => void) | null, oldViews: boolean;
function scope(job: any) { return job?.employer_id ? job.employer_id === P : job?.user_id ? job.user_id === A : job?.created_by === A; }
function client() {
  return { from: (table: string) => {
    let fields = '', head = false, count = false, payload: any, start = 0, end = Infinity;
    const checks: Array<(row: any) => boolean> = [];
    const query: any = {
      select: (value: string, options: any = {}) => { fields = value; head = !!options.head; count = !!options.count; return query; },
      eq: (key: string, value: any) => { checks.push(row => row[key] === value); return query; },
      is: (key: string, value: any) => { checks.push(row => value === null ? row[key] == null : row[key] === value); return query; },
      or: (_expression: string, options?: any) => { checks.push(row => scope(options?.referencedTable === 'jobs' ? row.jobs : row)); return query; },
      order: () => query, range: (a: number, b: number) => { start = a; end = b + 1; return query; }, limit: (n: number) => { end = n; return query; },
      update: (value: any) => { payload = value; return query; },
    };
    const run = async (single = false) => {
      calls.push({ table, fields, head, start });
      if (oldViews && table === 'resumes' && fields === 'views') return { data: null, error: { code:'42703',message:'column resumes.views does not exist' } };
      if (failure === table) return { data: null, count: null, error: { message: 'PRIVATE database error' } };
      if (payload) { writes.push({ table, payload }); if (race) { const callback = race; race = null; callback(); } }
      let selected = rows[table].map(row => table === 'job_applications' ? { ...row, jobs: rows.jobs.find(job => job.id === row.job_id) } : row);
      if (fields.includes('jobs!inner')) selected = selected.filter(row => row.jobs);
      selected = selected.filter(row => checks.every(check => check(row)));
      if (payload) selected.forEach(row => Object.assign(row, payload));
      const projected = selected.slice(start, end).map(row => Object.fromEntries(fields.split(',').filter(key => !key.includes('(')).map(key => [key, row[key] ?? null])));
      return { data: head ? null : single ? projected[0] || null : projected, count: count ? selected.length : null, error: null };
    };
    query.maybeSingle = () => run(true); query.then = (resolve: any, reject: any) => run().then(resolve, reject); return query;
  } } as any;
}
const req = (method = 'GET', role = 'job_seeker', body?: any, origin = 'http://localhost') => new NextRequest(`http://localhost/api/account/profile?role=${role}`, { method, headers: { origin,'content-type':'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const put = (body: any, role = 'job_seeker') => PUT(req('PUT', role, { expected_updated_at: VERSION, ...body }));
beforeEach(() => {
  writes = []; calls = []; failure = ''; race = null; oldViews = false;
  rows = { job_seeker_profiles:[{ id:P,user_id:A,full_name:'Own seeker',phone:'+998901234567',district_id:100,region_id:22,about:'Own details',updated_at:VERSION,secret:'PRIVATE' },{ id:Q,user_id:B,full_name:'PRIVATE seeker',updated_at:VERSION }],
    employer_profiles:[{ id:P,user_id:A,company_name:'Own company',inn:'123456789',director_name:'Director',is_verified:false,updated_at:VERSION },{ id:Q,user_id:B,company_name:'PRIVATE company',updated_at:VERSION }],
    regions:[{ id:22,name_ru:'Ташкент',name_uz:'Toshkent' },{ id:9,name_ru:'Другая область',name_uz:'Other' }],districts:[{ id:100,region_id:22,name_ru:'Юнусабад',name_uz:'Yunusobod' }],resumes:[],jobs:[],job_applications:[] };
  (requireAccount as jest.Mock).mockImplementation(async () => ({ client:client(),user:{ id:A,phone:'+998901234567' } }));
  jest.spyOn(console,'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test('all profile endpoints require a current signed session', async () => {
  (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401,'Login'));
  expect((await GET(req())).status).toBe(401); expect((await put({ full_name:'Name' })).status).toBe(401); expect((await stats(req())).status).toBe(401); expect(calls).toEqual([]);
});
test.each(['job_seeker','employer'])('GET is scoped to the current owner and returns only permitted fields: %s', async role => {
  const response = await GET(req('GET',role)); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json(); expect(body.profile.account_phone).toBe('+998901234567'); expect(JSON.stringify(body)).not.toContain('PRIVATE'); expect(body.profile).not.toHaveProperty('user_id');
});
test('invalid role, missing role profile and another origin fail without writes', async () => {
  expect((await GET(req('GET','admin'))).status).toBe(400); rows.employer_profiles=[];
  expect((await GET(req('GET','employer'))).status).toBe(403);
  expect((await PUT(req('PUT','job_seeker',{ full_name:'Name' },'https://attacker.example'))).status).toBe(403); expect(writes).toEqual([]);
});
test('seeker updates normalize contacts and district names, without changing login identity or trusting owner fields', async () => {
  const response = await put({ full_name:' New name ',phone:'90 555 55 55',telegram:'https://t.me/candidate',birth_date:'2000-01-01',region_id:22,district_id:100,user_id:B,id:Q,password_hash:'PRIVATE',city:'Forged' });
  expect(response.status).toBe(200); expect(writes[0].payload).toMatchObject({ full_name:'New name',phone:'+998905555555',telegram:'candidate',city:'Yunusobod' });
  expect(writes[0].payload).not.toHaveProperty('user_id'); expect(writes[0].table).toBe('job_seeker_profiles'); expect(rows.job_seeker_profiles[1].full_name).toBe('PRIVATE seeker');
  expect((await response.json()).profile.account_phone).toBe('+998901234567'); expect(writes.some(write => write.table==='users')).toBe(false);
});
test.each([{ full_name:'' },{ birth_date:'2000-02-30' },{ birth_date:'2999-01-01' },{ phone:'bad' },{ telegram:'invalid username' },{ region_id:9,district_id:100 },{ district_id:999 },{ region_id:22.5 }])('invalid seeker input remains unsaved: %j', async payload => {
  expect((await put(payload)).status).toBe(400); expect(writes).toEqual([]);
});
test('legacy numeric city is resolved without erasing the profile and a missing region is inferred', async () => {
  rows.job_seeker_profiles[0].city='100'; rows.job_seeker_profiles[0].district_id=null; rows.job_seeker_profiles[0].region_id=null;
  const response=await GET(req()); expect((await response.json()).profile).toMatchObject({ district_id:100,region_id:22,districts:{ name_ru:'Юнусабад' } }); expect(writes).toEqual([]);
});
test('employer edits preserve the verification flag and reject invalid email, website and changed company identifier', async () => {
  for (const payload of [{ email:'invalid' },{ website:'javascript:alert(1)' },{ website:'https://user:pass@example.com' },{ inn:'wrong' },{ company_name:'' }]) expect((await put(payload,'employer')).status).toBe(400);
  const response = await put({ company_name:'Updated company',is_verified:true,verified_via:'forged',user_id:B },'employer');
  expect(response.status).toBe(200); expect(rows.employer_profiles[0].company_name).toBe('Updated company'); expect(rows.employer_profiles[0].is_verified).toBe(false); expect(writes[0].payload).not.toHaveProperty('is_verified');
});
test('verified company identity cannot be edited but its contact details remain editable', async () => {
  rows.employer_profiles[0].is_verified=true;
  for (const payload of [{ company_name:'Other company' },{ inn:'987654321' },{ director_name:'Other director' }]) expect((await put(payload,'employer')).status).toBe(409);
  expect(writes).toEqual([]); expect((await put({ phone:'90 555 55 55' },'employer')).status).toBe(200); expect(rows.employer_profiles[0].is_verified).toBe(true);
});
test('stale microsecond versions and a competing edit cannot overwrite a newer profile', async () => {
  expect((await put({ full_name:'Changed',expected_updated_at:'2026-10-07T00:00:00.123Z' })).status).toBe(409); expect(writes).toEqual([]);
  race = () => { rows.job_seeker_profiles[0].updated_at='2026-10-07T01:00:00Z'; rows.job_seeker_profiles[0].full_name='Newer name'; };
  expect((await put({ full_name:'Old editor' })).status).toBe(409); expect(rows.job_seeker_profiles[0].full_name).toBe('Newer name');
});
test('a concurrent company verification is protected even when an old client does not update updated_at', async () => {
  race = () => { rows.employer_profiles[0].is_verified=true; rows.employer_profiles[0].company_name='Verified company'; };
  expect((await put({ company_name:'Old editor' },'employer')).status).toBe(409); expect(rows.employer_profiles[0]).toMatchObject({ company_name:'Verified company',is_verified:true });
});
test('legacy null versions can save, and failures do not return a false success or SQL diagnostics', async () => {
  rows.job_seeker_profiles[0].updated_at=null; expect((await put({ full_name:'New',expected_updated_at:null })).status).toBe(200);
  failure='job_seeker_profiles'; const response = await GET(req()); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('PRIVATE');
});
test('seeker statistics sum the real views column beyond 1000 rows and scope every count', async () => {
  rows.resumes=Array.from({length:1205},(_,n)=>({id:id(10+n),user_id:A,views:2})); rows.resumes.push({id:id(9999),user_id:B,views:999});
  rows.job_applications=[{id:id(10),user_id:A},{id:id(11),user_id:B}];
  const response = await stats(req()); expect(response.status).toBe(200); expect((await response.json()).stats).toEqual({items:1205,applications:1,views:2410});
  expect(calls.filter(call=>call.table==='resumes'&&!call.head&&call.fields.includes('id')).map(call=>call.start)).toEqual([0,500,1000]);
});
test('employer statistics honor assigned-company priority and count applications without a jobs limit', async () => {
  rows.jobs=Array.from({length:1205},(_,n)=>({id:id(10+n),employer_id:P,user_id:B,views_count:2}));
  rows.jobs.push({id:id(9000),employer_id:Q,user_id:A,views_count:999},{id:id(9001),user_id:A,views_count:3},{id:id(9002),created_by:A,views_count:4},{id:id(9003),user_id:B,created_by:A,views_count:999});
  rows.job_applications=rows.jobs.map(job=>({id:job.id,job_id:job.id}));
  const response=await stats(req('GET','employer')); expect((await response.json()).stats).toEqual({items:1207,applications:1207,views:2417});
});
test('statistics support an older views_count schema and report database failures instead of zeros', async () => {
  oldViews=true; rows.resumes=[{id:id(10),user_id:A,views_count:7}]; expect((await (await stats(req())).json()).stats.views).toBe(7);
  failure='resumes'; const response=await stats(req()); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('PRIVATE');
});
