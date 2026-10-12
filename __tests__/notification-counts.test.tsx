import { act, renderHook, waitFor } from '@testing-library/react';
import { useNotificationCounts } from '@/hooks/use-notification-counts';
import { accountApi } from '@/lib/account-api';
jest.mock('@/lib/account-api', () => ({ accountApi: jest.fn() }));
let requests: Array<{ resolve: (value: any) => void; reject: (reason: any) => void }>;
beforeEach(() => {
  requests = []; jest.clearAllMocks();
  (accountApi as jest.Mock).mockImplementation(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
});

test('logout immediately hides counts and a delayed response cannot restore them', async () => {
  const view = renderHook(({ id }) => useNotificationCounts(id, 'employer'), { initialProps: { id: 'A' as string | undefined } });
  view.rerender({ id: undefined });
  await act(async () => requests[0].resolve({ messages: 20, applications: 50 }));
  expect(view.result.current).toEqual({ messages: 0, applications: 0 });
});
test('changing identity or role ignores old counts and old requests', async () => {
  const view = renderHook(({ id, role }) => useNotificationCounts(id, role), { initialProps: { id: 'A', role: 'employer' as 'employer' | 'job_seeker' } });
  await act(async () => requests[0].resolve({ messages: 20, applications: 50 }));
  view.rerender({ id: 'B', role: 'job_seeker' });
  expect(view.result.current).toEqual({ messages: 0, applications: 0 });
  await act(async () => requests[1].resolve({ messages: 2, applications: 3 }));
  expect(view.result.current).toEqual({ messages: 2, applications: 3 });
  view.rerender({ id: 'B', role: 'employer' });
  expect(view.result.current).toEqual({ messages: 0, applications: 0 });
});
test('overlapping events keep the newest response and failed refreshes preserve confirmed counts', async () => {
  const view = renderHook(() => useNotificationCounts('A', 'job_seeker'));
  act(() => window.dispatchEvent(new Event('applicationsRead')));
  await act(async () => requests[1].resolve({ messages: 2, applications: 3 }));
  await act(async () => requests[0].resolve({ messages: 100, applications: 100 }));
  expect(view.result.current).toEqual({ messages: 2, applications: 3 });
  act(() => window.dispatchEvent(new Event('messagesRead')));
  await act(async () => requests[2].reject(new Error('offline')));
  await waitFor(() => expect(view.result.current).toEqual({ messages: 2, applications: 3 }));
  view.unmount();
  window.dispatchEvent(new Event('messagesRead'));
  expect(requests).toHaveLength(3);
});
