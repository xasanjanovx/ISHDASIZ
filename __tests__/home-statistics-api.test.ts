/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { GET } from '@/app/api/home/stats/route';
import { getAuthClient } from '@/lib/auth/server';
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock('@/lib/auth/server', () => ({ getAuthClient: jest.fn() }));

it('recovers exact totals using HEAD requests and returns only the three public counts', async () => {
  const calls: { url: URL; method: string }[] = [];
  (getAuthClient as jest.Mock).mockReturnValue(createClient('https://synthetic.invalid', 'synthetic', {
    global: { fetch: async (url: any, init: any) => {
      calls.push({ url: new URL(String(url)), method: init.method });
      return new Response(null, { headers: { 'content-range': '0-0/7' } });
    } },
  }));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ stats: { totalJobs: 7, totalUsers: 7, archivedJobs: 14 } });
  expect(calls).toHaveLength(4);
  expect(calls.every(call => call.method === 'HEAD' && call.url.searchParams.get('select') === 'id')).toBe(true);
  expect(calls.some(call => call.url.searchParams.get('ishdasiz_job_available') === 'eq.true')).toBe(true);
});
it('rejects partial totals instead of publishing an incomplete number', async () => {
  (getAuthClient as jest.Mock).mockReturnValue(createClient('https://synthetic.invalid', 'synthetic', {
    global: { fetch: async (url: any) => new Response(null, { status: String(url).includes('source_status=') ? 503 : 200, headers: { 'content-range': '0-0/7' } }) },
  }));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try { expect((await GET()).status).toBe(503); } finally { log.mockRestore(); }
});
