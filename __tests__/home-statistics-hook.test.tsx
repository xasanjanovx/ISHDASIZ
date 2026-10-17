import { act, renderHook } from '@testing-library/react';
import { useHomeStatistics } from '@/hooks/use-home-statistics';

const initial = { totalJobs: 9502, archivedJobs: null, totalUsers: 614 };
const complete = { totalJobs: 9502, archivedJobs: 39249, totalUsers: 614 };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it('does not request counts when the server already supplied complete statistics', () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() => useHomeStatistics(complete));
  expect(result.current).toEqual(complete);
  expect(fetch).not.toHaveBeenCalled();
});
it('retries a temporary failure and recovers the complete total without a page reload', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ stats: complete }) });
  const { result } = renderHook(() => useHomeStatistics(initial));
  await act(async () => {});
  expect(result.current).toEqual(initial);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(result.current).toEqual(complete);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not accept partial data and cancels retries when leaving the page', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ stats: initial }) });
  const { result, unmount } = renderHook(() => useHomeStatistics(initial));
  await act(async () => {});
  expect(result.current).toEqual(initial);
  unmount();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(fetch).toHaveBeenCalledTimes(1);
});
