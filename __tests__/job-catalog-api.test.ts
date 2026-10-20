/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GET } from '@/app/api/jobs/route';
import { getAuthClient } from '@/lib/auth/server';
import { getIndexedRemoteJobIds, getRemoteJobIds, hasIndexedCatalog } from '@/lib/job-search-server';
import { JOB_CATALOG_FIELDS } from '@/lib/job-catalog';
jest.mock('@/lib/auth/server', () => ({ getAuthClient: jest.fn() }));
jest.mock('@/lib/job-search-server', () => ({ getIndexedRemoteJobIds: jest.fn(), getRemoteJobIds: jest.fn(), hasIndexedCatalog: jest.fn() }));
const remoteId = '30000000-0000-4000-8000-000000000003';
let requested: URL;
let missingCount = false;
let countReadFails = false;
let countTimeoutOnce = false;
let requests: URL[];
beforeEach(() => {
  jest.clearAllMocks();
  missingCount = false; countReadFails = false; countTimeoutOnce = false; requests = [];
  (hasIndexedCatalog as jest.Mock).mockResolvedValue(false);
  (getRemoteJobIds as jest.Mock).mockResolvedValue([remoteId]);
  (getIndexedRemoteJobIds as jest.Mock).mockResolvedValue([remoteId]);
  (getAuthClient as jest.Mock).mockReturnValue(createClient('https://synthetic.invalid', 'synthetic', {
    global: { fetch: async (url: any) => {
      const actual = new URL(String(url)); requests.push(actual);
      if (actual.searchParams.get('limit') !== '0') requested = actual;
      if(countTimeoutOnce && actual.searchParams.get('limit') === '0'){countTimeoutOnce=false;return new Response(JSON.stringify({code:'57014'}),{status:500});}
      if(countReadFails && actual.searchParams.get('limit') === '0') return new Response(JSON.stringify({code:'57014'}),{status:500});
      return new Response(JSON.stringify([{ id: 'public-job', title_uz: 'Tikuvchi' }]), {
        headers: { 'content-type': 'application/json', ...(missingCount ? {} : { 'content-range': '0-0/370' }) },
      });
    } },
  }));
});
test('installed catalog indexes avoid the full remote-format scan for regional filters', async () => {
  (hasIndexedCatalog as jest.Mock).mockResolvedValue(true);
  const response = await GET(new NextRequest('https://synthetic.invalid/api/jobs?region=12'));
  expect(response.status).toBe(200);
  expect(getRemoteJobIds).not.toHaveBeenCalled();
  expect(getIndexedRemoteJobIds).toHaveBeenCalledTimes(1);
  expect(requested.searchParams.get('or')).toContain(`id.in.(${remoteId})`);
  expect(requested.searchParams.get('or')).not.toContain('ishdasiz_job_work_mode');
  expect(requested.searchParams.get('is_active')).toBe('eq.true');
  expect(requested.searchParams.get('ishdasiz_job_available')).toBe('eq.true');
});
test('large remote catalogs use the computed filter instead of an oversized URL', async () => {
  (hasIndexedCatalog as jest.Mock).mockResolvedValue(true);
  (getIndexedRemoteJobIds as jest.Mock).mockResolvedValue(Array(151).fill(remoteId));
  expect((await GET(new NextRequest('https://synthetic.invalid/api/jobs?region=12'))).status).toBe(200);
  expect(requested.searchParams.get('or')).toContain('ishdasiz_job_work_mode.eq.remote');
  expect(requested.searchParams.get('or')).not.toContain('id.in.');
});
test('public search preserves visibility, field projection, filters and bounded pagination', async () => {
  const response = await GET(new NextRequest('https://synthetic.invalid/api/jobs?q=tikuvchi&region=22&page=2'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: [{ id: 'public-job', title_uz: 'Tikuvchi' }], count: 370 });
  expect(requested.searchParams.get('ishdasiz_job_available')).toBe('eq.true');
  expect(requested.searchParams.get('select')).toBe(JOB_CATALOG_FIELDS);
  expect(JOB_CATALOG_FIELDS).not.toMatch(/\*|user_id|created_by|employer_id|raw_source_json|phone/);
  expect(requested.searchParams.get('or')).toContain('title_uz.ilike.%tikuvchi%');
  expect(requested.searchParams.get('or')).toContain('region_id.eq.22');
  expect(requested.searchParams.get('or')).toContain(`id.in.(${remoteId})`);
  expect(requested.searchParams.get('or')).not.toContain('ishdasiz_job_work_mode');
  expect(requested.searchParams.get('offset')).toBe('12');
  expect(requested.searchParams.get('limit')).toBe('12');
  expect(response.headers.get('cache-control')).toBe('no-store');
});
test('missing exact counts are an error rather than an empty catalog', async () => {
  missingCount = true;
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try { expect((await GET(new NextRequest('https://synthetic.invalid/api/jobs'))).status).toBe(503); }
  finally { log.mockRestore(); }
});

test('a failed format lookup is not silently treated as an empty remote catalog', async () => {
 (getRemoteJobIds as jest.Mock).mockRejectedValue(new Error('Unavailable'));
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 try { expect((await GET(new NextRequest('https://synthetic.invalid/api/jobs?region=12'))).status).toBe(503); }
 finally { log.mockRestore(); }
});


test('salary counts use two disjoint zero-row reads with identical privacy and geographic guards', async () => {
 const response=await GET(new NextRequest('https://synthetic.invalid/api/jobs?salary=5000000-&region=12&page=3'));
 expect(response.status).toBe(200);expect((await response.json()).count).toBe(740);
 const totals=requests.filter(url=>url.searchParams.get('limit')==='0');expect(totals).toHaveLength(2);
 expect(totals.every(url=>url.searchParams.get('select')==='id'&&url.searchParams.get('ishdasiz_job_available')==='eq.true'&&url.searchParams.get('is_active')==='eq.true'&&!url.searchParams.has('offset'))).toBe(true);
 expect(totals.every(url=>url.searchParams.get('or')?.includes('region_id.eq.12'))).toBe(true);
 expect(totals.some(url=>url.searchParams.get('salary_min')==='gte.5000000')).toBe(true);expect(totals.some(url=>url.searchParams.get('salary_max')==='gte.5000000')).toBe(true);
 expect(totals.find(url=>url.searchParams.has('salary_max'))!.searchParams.get('or')).toContain('salary_min.lt.5000000,salary_min.is.null');
 expect(requested.searchParams.get('offset')).toBe('24');expect(requested.searchParams.get('limit')).toBe('12');
});
test('a failed count branch never presents a partial total as a successful result',async()=>{
 countReadFails=true;const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 try{expect((await GET(new NextRequest('https://synthetic.invalid/api/jobs?salary=5000000-'))).status).toBe(503);}finally{log.mockRestore();}
});


test('one timed-out count is retried without repeating the successful card request',async()=>{
 countTimeoutOnce=true;
 const response=await GET(new NextRequest('https://synthetic.invalid/api/jobs?salary=5000000-'));
 expect(response.status).toBe(200);expect((await response.json()).count).toBe(740);
 expect(requests.filter(url=>url.searchParams.get('limit')!=='0')).toHaveLength(1);
 expect(requests.filter(url=>url.searchParams.get('limit')==='0')).toHaveLength(3);
});
