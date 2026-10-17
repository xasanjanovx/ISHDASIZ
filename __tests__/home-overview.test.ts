/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { readHomeOverview } from '@/lib/home-overview';
import { validHomeOverview } from '@/lib/home-overview-types';
const category = 'a0000001-0001-4000-8000-000000000001';
const now = Date.parse('2026-10-17T08:00:00Z');
let requests: { url: URL; method: string }[], active: number, peak: number, fail: boolean;
beforeEach(() => {
  requests = []; active = 0; peak = 0; fail = false;

});
function client() {
  return createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (input: any, init: any) => {
    const url = new URL(String(input)); requests.push({ url, method: init.method });
    if (url.pathname.includes('/rpc/')) return Response.json({ total: 10, categories: { [category]: 2 }, special: { students: 4, disabled: 1, women: 8 } });
    if (url.pathname.endsWith('/categories')) return Response.json([{ id: category }]);
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    if (fail && url.searchParams.get('category_id')) return new Response(null, { status: 503 });
    const available = url.searchParams.get('ishdasiz_job_available') === 'eq.true';
    const count = available ? 10 : url.searchParams.has('source_status') ? 2 : 3;
    return new Response(null, { headers: { 'content-range': `0-0/${count}` } });
  } } });
}
it('combines active and both archive slices within each scope and bounds concurrent reads', async () => {
  const result = await readHomeOverview(client(), () => now);
  expect(result.categoryCounts).toEqual({ [category]: 7 });
  expect(result.specialCounts).toEqual({ students: 9, disabled: 6, women: 13 });
  expect(peak).toBeLessThanOrEqual(4);
  expect(peak).toBeGreaterThan(1);
  expect(validHomeOverview(result)).toBe(true);
  const counts = requests.filter(request => request.url.pathname.endsWith('/jobs'));
  expect(counts.every(request => request.method === 'HEAD' && request.url.searchParams.get('select') === 'id')).toBe(true);
  const studentSlice = counts.find(request => request.url.searchParams.has('source_status') && request.url.searchParams.get('or')?.includes('is_for_students'))!;
  expect(studentSlice.url.searchParams.get('or')).toBe('(and(or(status.is.null,status.in.(active,published,open)),or(is_for_students.eq.true,is_for_graduates.eq.true)))');
  const categorySlices = counts.filter(request => request.url.searchParams.get('category_id') === `eq.${category}`);
  expect(categorySlices).toHaveLength(2);
});
it('does not read or expose import operations in the public overview', async () => {
  const result = await readHomeOverview(client(), () => now);
  expect(result).not.toHaveProperty('source');
  expect(requests.some(request => /import|source=/.test(request.url.toString()))).toBe(false);
});
it('never substitutes a partial archive response for a complete count', async () => {
  fail = true;
  await expect(readHomeOverview(client(), () => now)).rejects.toThrow('Home overview unavailable');
});
