/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/account/notifications/route';
import { AccountError, requireAccount } from '@/lib/auth/account';
import { unreadMessages } from '@/lib/account-chat';
import { employerJobScope, jobBelongsToEmployer } from '@/lib/account-jobs';
jest.mock('@/lib/auth/account', () => ({ ...jest.requireActual('@/lib/auth/account'), requireAccount: jest.fn() }));
jest.mock('@/lib/account-chat', () => ({ ...jest.requireActual('@/lib/account-chat'), unreadMessages: jest.fn() }));
const A = 'signed-user';
let apps: any[], profileExists: boolean, dbError: any, selects: string[];
function client() {
  return { from: (table: string) => {
    const filters: ((row: any) => boolean)[] = [];
    const query: any = {
      select: (fields: string) => { if (table === 'job_applications') selects.push(fields); return query; },
      eq: (field: string, value: any) => { filters.push(row => field.split('.').reduce((v, key) => v?.[key], row) === value); return query; },
      in: (field: string, values: any[]) => { filters.push(row => values.includes(row[field])); return query; },
      or: (scope: string, options: any) => { expect(scope).toBe(employerJobScope(A, 'profile')); expect(options).toEqual({ referencedTable: 'jobs' }); filters.push(row => jobBelongsToEmployer(row.jobs || {}, A, 'profile')); return query; },
      maybeSingle: async () => ({ data: profileExists ? { id: 'profile' } : null, error: null }),
      then: (resolve: any, reject: any) => Promise.resolve({ count: apps.filter(row => filters.every(check => check(row))).length, error: dbError }).then(resolve, reject),
    };
    return query;
  } };
}
const request = (role = 'job_seeker') => new NextRequest(`http://localhost/api/account/notifications?role=${role}&user_id=another-user`);
beforeEach(() => {
  jest.clearAllMocks(); apps = []; profileExists = true; dbError = null; selects = [];
  (requireAccount as jest.Mock).mockResolvedValue({ client: client(), user: { id: A } });
  (unreadMessages as jest.Mock).mockResolvedValue(4);
});
test('an unsigned request fails before counting applications', async () => {
  (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401, 'Login required'));
  expect((await GET(request())).status).toBe(401); expect(selects).toEqual([]);
});
test('a role without a profile cannot read notification counts', async () => {
  profileExists = false; expect((await GET(request('employer'))).status).toBe(403);
  expect(selects).toEqual([]);
});
test('a seeker only counts their unseen changes, including rejected and invited applications', async () => {
  apps = [
    { user_id: A, status: 'rejected', is_seen_by_job_seeker: false },
    { user_id: A, status: 'invited', is_seen_by_job_seeker: false },
    { user_id: A, status: 'accepted', is_seen_by_job_seeker: true },
    { user_id: A, status: 'pending', is_seen_by_job_seeker: false },
    { user_id: 'another-user', status: 'accepted', is_seen_by_job_seeker: false },
  ];
  const result = await GET(request());
  expect(await result.json()).toEqual({ applications: 2, messages: 4 });
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(unreadMessages).toHaveBeenCalledWith(expect.anything(), A, 'job_seeker');
});
test('an employer counts pending applications through ownership of the joined job without a 1000-job lookup', async () => {
  apps = Array.from({ length: 1001 }, () => ({ jobs: { created_by: A }, status: 'pending' }));
  apps.push({ jobs: { created_by: 'another-user' }, status: 'pending' }, { jobs: { created_by: A }, status: 'accepted' });
  expect(await (await GET(request('employer'))).json()).toEqual({ applications: 1001, messages: 4 });
  expect(selects).toEqual(['id, jobs!inner(id)']);
});
test('company assignments and legacy creators are supported without retaining a former owner', async () => {
  apps = [
    { jobs: { employer_id: 'profile', created_by: 'administrator' }, status: 'pending' },
    { jobs: { user_id: A }, status: 'pending' },
    { jobs: { created_by: A }, status: 'pending' },
    { jobs: { employer_id: 'other-company', created_by: A }, status: 'pending' },
    { jobs: { user_id: 'new-owner', created_by: A }, status: 'pending' },
  ];
  expect(await (await GET(request('employer'))).json()).toEqual({ applications: 3, messages: 4 });
});
test('a database error is not presented as zero unread notifications', async () => {
  dbError = { code: '42703', message: 'Private database details' };
  const response = await GET(request());
  expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('Private database details');
});
