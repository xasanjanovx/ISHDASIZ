/** @jest-environment node */
import { GET } from '@/app/api/map/jobs/route';
import { getAuthClient } from '@/lib/auth/server';
import { JOB_MAP_FIELDS, JOB_MAP_PAGE_SIZE } from '@/lib/job-map-query';
jest.mock('@/lib/auth/server', () => ({ getAuthClient: jest.fn() }));
jest.mock('next/cache',()=>({unstable_cache:(fn:any)=>fn}));
const query: any = {};
const read = jest.fn();
for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'range','limit']) query[method] = jest.fn(() => query);
query.abortSignal = read;
const from = jest.fn(() => query);
const row = { id: '10000000-0000-4000-8000-000000000001', title_ru: 'Врач', latitude: 41.3, longitude: 69.2,
  regions: { name_ru: 'Ташкент', name_uz: 'Toshkent', phone: 'private' },
  categories: [{ id: 'category', name_ru: 'Медицина', icon: 'Heart', password_hash: 'private' }],
  raw_source_json: { contact: 'private' }, user_id: 'private', phone: 'private' };
const request = (query = '') => new Request('https://example.com/api/map/jobs' + query);
beforeEach(() => {
  jest.clearAllMocks();
  (getAuthClient as jest.Mock).mockReturnValue({ from });
  read.mockResolvedValue({ data: [row], count: 6405, error: null });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('anonymous callers receive only public map fields with exact totals and a bounded query', async () => {
  const response = await GET(request('?page=1'));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(from).toHaveBeenCalledWith('jobs');
  expect(query.select).toHaveBeenCalledWith(JOB_MAP_FIELDS, { count: 'exact' });
  expect(query.eq).toHaveBeenCalledWith('ishdasiz_job_available', true);
  expect(query.gte).toHaveBeenCalledWith('latitude', -90);
  expect(query.lte).toHaveBeenCalledWith('latitude', 90);
  expect(query.gte).toHaveBeenCalledWith('longitude', -180);
  expect(query.lte).toHaveBeenCalledWith('longitude', 180);
  expect(query.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]]);
  expect(query.range).toHaveBeenCalledWith(JOB_MAP_PAGE_SIZE, JOB_MAP_PAGE_SIZE * 2 - 1);
  expect(read).toHaveBeenCalledWith(expect.any(AbortSignal));
  const body = await response.json();
  expect(body).toMatchObject({ total: 6405, jobs: [{ id: row.id, latitude: 41.3, longitude: 69.2, regions: { name_ru: 'Ташкент' } }] });
  expect(JSON.stringify(body)).not.toMatch(/private|password_hash|raw_source_json|user_id/);
  expect(body.jobs[0].categories).toEqual({ id: 'category', name_ru: 'Медицина', name_uz: null, icon: 'Heart' });
});
test.each(['?page=-1', '?page=1.5', '?page=10000', '?page=01', '?page=a', '?page=0&page=1', '?select=*'])('rejects invalid or arbitrary query parameters before database access: %s', async params => {
  expect((await GET(request(params))).status).toBe(400);
  expect(getAuthClient).not.toHaveBeenCalled();
});
test.each([
  { data: null, count: null, error: { message: 'private database diagnostic' } },
  { data: [], count: null, error: null },
  { data: [row], count: 0, error: null },
  { data: [{ ...row, latitude: 91 }], count: 1, error: null },
  { data: [{ ...row, longitude: '69' }], count: 1, error: null },
  { data: [{ ...row, id: 'invalid' }], count: 1, error: null },
])('does not disguise failed or malformed results as an empty map', async value => {
  read.mockResolvedValue(value);
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private');
});
test('genuine empty map and an exhausted page keep their exact total', async () => {
  read.mockResolvedValue({ data: [], count: 0, error: null });
  expect(await (await GET(request())).json()).toEqual({ jobs: [], total: 0 });
  read.mockResolvedValue({ data: [], count: 12, error: null });
  expect(await (await GET(request('?page=1'))).json()).toEqual({ jobs: [], total: 12 });
});

test('a transient SQL timeout retries the failed read once and retains the real count', async () => {
  read.mockResolvedValueOnce({ data: null, count: null, error: { code: '57014' }, status: 500 });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).total).toBe(6405);
  expect(read).toHaveBeenCalledTimes(2);
});

test('point pages never recount the table and use one extra row for hasMore',async()=>{
 read.mockResolvedValue({data:Array.from({length:51},(_,i)=>({...row,id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`})),count:null,error:null});
 const response=await GET(request('?mode=page&page=2'));expect(response.status).toBe(200);
 expect(query.select).toHaveBeenCalledWith(JOB_MAP_FIELDS,{count:undefined});
 expect(query.eq).toHaveBeenCalledWith('is_active',true);expect(query.range).toHaveBeenCalledWith(100,150);
 const body=await response.json();expect(body.jobs).toHaveLength(50);expect(body).toMatchObject({total:null,hasMore:true});expect(read).toHaveBeenCalledTimes(1);
});
test('a burst of map-count callers shares one bounded ID-only read',async()=>{
 const results=await Promise.all(Array.from({length:10},()=>GET(request('?mode=count'))));
 expect(read).toHaveBeenCalledTimes(1);expect(query.select).toHaveBeenCalledWith('id',{count:'exact'});expect(query.limit).toHaveBeenCalledWith(0);
 expect(query.range).not.toHaveBeenCalled();expect(query.order).not.toHaveBeenCalled();
 for(const response of results)expect(await response.json()).toEqual({total:6405});
});
test('failed point-page reads do not immediately repeat an overloaded query',async()=>{
 read.mockResolvedValue({data:null,count:null,error:{code:'57014'},status:500});
 expect((await GET(request('?mode=page'))).status).toBe(503);expect(read).toHaveBeenCalledTimes(1);
});
