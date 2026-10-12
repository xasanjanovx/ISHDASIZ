import { act, renderHook } from '@testing-library/react';
import { useApplications } from '@/hooks/use-applications';
import { accountApi, AccountApiError } from '@/lib/account-api';
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
const api = accountApi as jest.Mock;
let requests: Array<{ url: string; init: any; resolve: (value: any) => void; reject: (error: any) => void }>;
const row = (id = 'one', status = 'pending') => ({ id, status, responded_at: null, is_seen_by_job_seeker: false });
const page = (applications: any[] = [row()], nextCursor: string | null = null) => ({ applications, nextCursor, stats: { total: 1, pending: 1, reviewed: 0, interview_set: 0, accepted: 0, rejected: 0, hired: 0 } });
beforeEach(() => {
  jest.clearAllMocks(); requests = [];
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  api.mockImplementation((url, init) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject })));
});
test('logout or identity change hides data immediately and ignores delayed private responses', async () => {
  const view = renderHook(({ user }) => useApplications(user, 'employer'), { initialProps: { user: 'A' as string | undefined } });
  await act(async () => requests[0].resolve(page())); view.rerender({ user: 'B' }); expect(view.result.current.applications).toEqual([]);
  view.rerender({ user: undefined }); await act(async () => requests[1].resolve(page([row('B-private')]))); expect(view.result.current.applications).toEqual([]); expect(view.result.current.isLoading).toBe(false);
});
test('filters use the server and discard old filter responses; errors support refresh', async () => {
  const view = renderHook(({ filter }) => useApplications('A', 'employer', filter), { initialProps: { filter: 'all' } });
  view.rerender({ filter: 'accepted' }); expect(requests[1].url).toContain('status=accepted');
  await act(async () => requests[1].reject(new AccountApiError(503))); expect(view.result.current.error).toBeInstanceOf(AccountApiError);
  await act(async () => requests[0].resolve(page())); expect(view.result.current.applications).toEqual([]);
  act(() => view.result.current.retry()); await act(async () => requests[2].resolve(page([row('accepted', 'accepted')]))); expect(view.result.current.error).toBeNull(); expect(view.result.current.applications[0].id).toBe('accepted');
});
test('pagination prevents duplicate clicks, keeps rows on failure and deduplicates retries', async () => {
  const view = renderHook(() => useApplications('A', 'employer'));
  await act(async () => requests[0].resolve(page([row()], 'one')));
  act(() => { void view.result.current.loadMore(); void view.result.current.loadMore(); }); expect(requests).toHaveLength(2);
  await act(async () => requests[1].reject(new AccountApiError(503))); expect(view.result.current.applications).toHaveLength(1); expect(view.result.current.notice).toBeTruthy();
  act(() => { void view.result.current.retry(); }); await act(async () => requests[2].resolve(page([row('one', 'accepted'), row('two')])));
  expect(view.result.current.applications.map(app => app.id)).toEqual(['one', 'two']); expect(view.result.current.applications[0].status).toBe('pending'); expect(view.result.current.notice).toBeNull();
});
test('employer lists never auto-mark all applications; double writes are locked and counts change only after success', async () => {
  const view = renderHook(() => useApplications('A', 'employer'));
  await act(async () => requests[0].resolve(page())); expect(requests).toHaveLength(1);
  let first: Promise<any>;
  act(() => { first = view.result.current.patchApplication(view.result.current.applications[0], 'view'); void view.result.current.patchApplication(view.result.current.applications[0], 'view'); });
  expect(requests).toHaveLength(2); expect(view.result.current.stats?.pending).toBe(1);
  await act(async () => { requests[1].resolve({ application: row('one', 'reviewed') }); await first; }); expect(view.result.current.stats?.pending).toBe(0); expect(view.result.current.stats?.reviewed).toBe(1); expect(view.result.current.busyIds).toEqual([]);
});
test('a failed decision preserves the confirmed status and allows retry', async () => {
  const view = renderHook(() => useApplications('A', 'employer')); await act(async () => requests[0].resolve(page()));
  let error: any;
  act(() => { void view.result.current.patchApplication(view.result.current.applications[0], 'status', 'rejected').catch(value => { error = value; }); });
  await act(async () => requests[1].reject(new AccountApiError(409))); expect(error.status).toBe(409); expect(view.result.current.applications[0].status).toBe('pending'); expect(view.result.current.busyIds).toEqual([]);
});
test('seeker acknowledgements wait for visibility and send exact versions in batches of 20', async () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  const view = renderHook(() => useApplications('A', 'job_seeker'));
  const applications = Array.from({ length: 45 }, (_, index) => ({ ...row(String(index), 'reviewed'), responded_at: '2026-10-07T00:00:00.123456Z' }));
  await act(async () => requests[0].resolve(page(applications))); expect(requests).toHaveLength(1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(requests.slice(1).map(request => JSON.parse(request.init.body).applications.length)).toEqual([20, 20, 5]);
  expect(JSON.parse(requests[1].init.body).applications[0].responded_at).toBe('2026-10-07T00:00:00.123456Z');
  await act(async () => requests.slice(1).forEach((request, index) => request.resolve({ seen: applications.slice(index * 20, (index + 1) * 20).map(app => app.id), changed: [] })));
  expect(view.result.current.applications.every(app => app.is_seen_by_job_seeker)).toBe(true);
});
test('a changed decision remains unread and asks the seeker to refresh', async () => {
  const view = renderHook(() => useApplications('A', 'job_seeker')); await act(async () => requests[0].resolve(page([row('one', 'reviewed')])));
  await act(async () => requests[1].resolve({ seen: [], changed: ['one'] })); expect(view.result.current.applications[0].is_seen_by_job_seeker).toBe(false); expect((view.result.current.notice as AccountApiError).status).toBe(409);
});

test('a late read receipt from a previous account cannot clear the next account notification', async () => {
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
  const view=renderHook(({user})=>useApplications(user,'job_seeker'),{initialProps:{user:'A'}});
  await act(async()=>requests[0].resolve(page([row('one','reviewed')])));
  expect(requests).toHaveLength(2);
  view.rerender({user:'B'});
  await act(async()=>requests[2].resolve(page([row('one','reviewed')])));
  expect(requests).toHaveLength(4);
  await act(async()=>requests[1].resolve({seen:['one'],changed:[]}));
  expect(view.result.current.applications[0].is_seen_by_job_seeker).toBe(false);
  await act(async()=>requests[3].resolve({seen:['one'],changed:[]}));
  expect(view.result.current.applications[0].is_seen_by_job_seeker).toBe(true);
});

test('pending applications remain unacknowledged until an employer response is displayed', async () => {
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
  const view=renderHook(()=>useApplications('A','job_seeker'));
  await act(async()=>requests[0].resolve(page([row('pending','pending'),row('decided','accepted')])));
  expect(JSON.parse(requests[1].init.body).applications.map((app:any)=>app.id)).toEqual(['decided']);
  await act(async()=>requests[1].resolve({seen:['decided'],changed:[]}));
  expect(view.result.current.applications.find(app=>app.id==='pending')?.is_seen_by_job_seeker).toBe(false);
});
