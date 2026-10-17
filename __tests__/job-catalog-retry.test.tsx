import { act, renderHook } from '@testing-library/react';
import { useJobCatalog } from '@/hooks/use-job-catalog';
const originalFetch = global.fetch;
const success = { ok: true, json: async () => ({ data: [{ id: 'job' }], count: 1 }) };
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
const advance = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

it('recovers a transient regional 503 while keeping loading rather than showing an empty catalog', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce(success);
  const { result } = renderHook(() => useJobCatalog('region=12'));
  await advance(300);
  expect(result.current).toMatchObject({ loading: true, loadError: false, totalCount: null });
  await advance(800);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({ loading: false, loadError: false, totalCount: 1 });
});
it('cancels an old retry when the region changes', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue(success);
  const { result, rerender } = renderHook(({ region }) => useJobCatalog('region=' + region), { initialProps: { region: '12' } });
  await advance(300); rerender({ region: '22' }); await advance(2000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect((fetch as jest.Mock).mock.calls[1][0]).toBe('/api/jobs?region=22');
  expect(result.current.totalCount).toBe(1);
});
it('bounds repeated network failures and still offers an explicit retry', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('Network unavailable'));
  const { result } = renderHook(() => useJobCatalog('region=12'));
  await advance(300); await advance(800); await advance(1600);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(result.current).toMatchObject({ loading: false, loadError: true, totalCount: 0 });
});
it('does not retry rejected requests or invalid counts', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
  const { result } = renderHook(() => useJobCatalog('region=12'));
  await advance(300); await advance(10000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.current.loadError).toBe(true);
});
