import { act, renderHook } from '@testing-library/react';
import { useResumeCatalog } from '@/hooks/use-resume-catalog';
import { accountApi, AccountApiError } from '@/lib/account-api';
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
let requests: Array<{ url: string; init: any; resolve: (data: any) => void; reject: (error: any) => void }>;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); requests = [];
  (accountApi as jest.Mock).mockImplementation((url, init) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject })));
});
afterEach(() => jest.useRealTimers());
const page = (ids: string[], nextCursor: string | null = null) => ({ resumes: ids.map(id => ({ id })), nextCursor });
const tick = () => act(() => jest.advanceTimersByTime(300));
test('rapid typing is debounced and previous responses cannot replace new search results', async () => {
  const view = renderHook(({ query }) => useResumeCatalog(query), { initialProps: { query: '' } });
  view.rerender({ query: 'q=r' }); view.rerender({ query: 'q=react' }); tick(); expect(requests).toHaveLength(1); expect(requests[0].url).toBe('/api/resumes?q=react');
  view.rerender({ query: 'q=js' }); expect(requests[0].init.signal.aborted).toBe(true); tick();
  await act(async () => requests[1].resolve(page(['new']))); await act(async () => requests[0].resolve(page(['old'])));
  expect(view.result.current.resumes.map(row => row.id)).toEqual(['new']);
});
test('failed first searches show errors and refresh can recover', async () => {
  const view = renderHook(() => useResumeCatalog('region=22')); tick(); await act(async () => requests[0].reject(new AccountApiError(503)));
  expect(view.result.current.loading).toBe(false); expect(view.result.current.error).toBeTruthy();
  act(() => view.result.current.refresh()); expect(view.result.current.loading).toBe(true); tick(); await act(async () => requests[1].resolve(page(['one'])));
  expect(view.result.current.error).toBeNull(); expect(view.result.current.resumes).toHaveLength(1);
});
test('double continuation clicks are locked, failed pages keep results and retries deduplicate', async () => {
  const view = renderHook(() => useResumeCatalog('q=js')); tick(); await act(async () => requests[0].resolve(page(['one'], 'cursor')));
  act(() => { void view.result.current.loadMore(); void view.result.current.loadMore(); }); expect(requests).toHaveLength(2); expect(requests[1].url).toContain('before=cursor');
  await act(async () => requests[1].reject(new AccountApiError(503))); expect(view.result.current.resumes).toHaveLength(1); expect(view.result.current.moreError).toBeTruthy();
  act(() => { void view.result.current.loadMore(); }); await act(async () => requests[2].resolve(page(['one','two'])));
  expect(view.result.current.resumes.map(row => row.id)).toEqual(['one','two']); expect(view.result.current.moreError).toBeNull(); expect(view.result.current.nextCursor).toBeNull();
});
test('an empty scan batch can continue and does not terminate the search prematurely', async () => {
  const view = renderHook(() => useResumeCatalog('q=rare')); tick(); await act(async () => requests[0].resolve(page([], 'cursor')));
  expect(view.result.current.nextCursor).toBe('cursor'); act(() => { void view.result.current.loadMore(); });
  await act(async () => requests[1].resolve(page(['found']))); expect(view.result.current.resumes[0].id).toBe('found');
});
test('late pagination from a previous filter is discarded and its lock does not block the new filter', async () => {
  const view = renderHook(({ query }) => useResumeCatalog(query), { initialProps: { query: 'region=22' } }); tick(); await act(async () => requests[0].resolve(page(['old'], 'oldCursor')));
  act(() => { void view.result.current.loadMore(); }); view.rerender({ query: 'region=9' }); tick(); await act(async () => requests[2].resolve(page(['new'], 'newCursor')));
  await act(async () => requests[1].resolve(page(['wrong']))); expect(view.result.current.resumes.map(row => row.id)).toEqual(['new']);
  act(() => { void view.result.current.loadMore(); }); expect(requests[3].url).toContain('before=newCursor'); await act(async () => requests[3].resolve(page(['last'])));
});
test('unmount cancels a queued or running first search', () => {
  const queued = renderHook(() => useResumeCatalog('')); queued.unmount(); tick(); expect(requests).toHaveLength(0);
  const active = renderHook(() => useResumeCatalog('q=js')); tick(); active.unmount(); expect(requests[0].init.signal.aborted).toBe(true);
});
