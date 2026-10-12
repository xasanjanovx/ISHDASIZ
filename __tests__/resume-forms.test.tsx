import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewResume from '@/app/profile/job-seeker/resumes/new/page';
import EditResume from '@/app/profile/job-seeker/resumes/[id]/page';
import { accountApi, AccountApiError } from '@/lib/account-api';
const R = '00000000-0000-4000-8000-000000000003', C = '00000000-0000-4000-8000-000000000004';
let mockUser: any;
const mockPush = jest.fn(), mockOpen = jest.fn();
jest.mock('next/navigation', () => ({ useParams: () => ({ id: R }), useRouter: () => ({ push: mockPush }), useSearchParams: () => new URLSearchParams() }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: mockUser, isLoading: false }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: mockOpen }) }));
jest.mock('@/components/profile/profile-layout', () => ({ ProfileLayout: ({ children }: any) => <div>{children}</div> }));
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
jest.mock('@/lib/regions', () => ({ getDistrictById: async () => ({ id: 100, region_id: 22 }) }));
jest.mock('@/components/ui/location-select', () => ({ LocationSelect: () => <div>Location</div> }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  if (table !== 'categories') throw new Error('Unexpected private browser query');
  const query: any = { select: () => query, neq: () => query, order: async () => ({ data: [{ id: C, name_ru: 'IT', name_uz: 'IT' }], error: null }) }; return query;
} } }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const api = accountApi as jest.Mock;
const resume = { id: R, title: 'My resume', full_name: 'Candidate', phone: '+998901234567', region_id: 22, district_id: 100, category_id: C, birth_date: '2000-01-01', about: 'My experience', experience: 'no_experience', education_level: 'secondary', status: 'active', is_public: true, updated_at: '2026-10-07T00:00:00.123456Z', experience_details: [{ company: 'A', position: 'Role' }, { company: 'B', position: 'Role' }], skills: [], education: [], languages: [] };
beforeEach(() => {
  jest.clearAllMocks(); api.mockReset(); mockUser = { id: 'A' };
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
  api.mockImplementation(async (url: string, init?: any) => init?.method ? { resume } : url.endsWith('/prefill') ? { profile: { full_name: 'Candidate', phone: '+998901234567', district_id: 100, region_id: 22 } } : { resume });
});
test('guests cannot load or edit a private resume and can open login', () => {
  mockUser = null; render(<EditResume />); fireEvent.click(screen.getByRole('button', { name: 'Войти' })); expect(mockOpen).toHaveBeenCalledTimes(1); expect(api).not.toHaveBeenCalled();
});
test('a denied resume never renders an empty editable form; loading can be retried', async () => {
  api.mockRejectedValueOnce(new AccountApiError(404)); render(<EditResume />); await screen.findByRole('alert'); expect(screen.queryByLabelText('Название резюме')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); expect(await screen.findByLabelText('Название резюме')).toHaveValue('My resume');
});
test('draft buttons save once, keep the form on failure and reuse their idempotency identifier', async () => {
  let reject: (error: any) => void = () => {}; render(<NewResume />); const title = await screen.findByLabelText('Название резюме'); fireEvent.change(title, { target: { value: 'My unfinished draft' } });
  api.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  const button = screen.getByRole('button', { name: 'Черновик' }); fireEvent.click(button); fireEvent.click(button);
  const calls = api.mock.calls.filter(([, init]) => init?.method === 'POST'); expect(calls).toHaveLength(1); const first = JSON.parse(calls[0][1].body); expect(first.status).toBe('draft'); expect(first).not.toHaveProperty('user_id');
  await act(async () => reject(new AccountApiError(503))); await screen.findByRole('alert'); expect(title).toHaveValue('My unfinished draft'); expect(mockPush).not.toHaveBeenCalled();
  fireEvent.click(button); await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/job-seeker/resumes')); const second = JSON.parse(api.mock.calls.at(-1)![1].body); expect(second.request_id).toBe(first.request_id);
});
test('adding a work entry does not submit, and editing independently removes entries without stored IDs', async () => {
  render(<EditResume />); await screen.findByLabelText('Название резюме');
  const buttons = screen.getAllByRole('button', { name: 'Добавить', exact: true }); fireEvent.click(buttons[0]); expect(api.mock.calls.filter(([, init]) => init?.method)).toHaveLength(0);
  const firstCompany = screen.getByDisplayValue('A'); const entry = firstCompany.closest('.relative')!; const remove = entry.querySelector('button')!; fireEvent.click(remove);
  expect(screen.queryByDisplayValue('A')).not.toBeInTheDocument(); expect(screen.getByDisplayValue('B')).toBeInTheDocument();
});
test('an edit sends the exact server version; a conflict preserves entered changes', async () => {
  render(<EditResume />); const title = await screen.findByLabelText('Название резюме'); fireEvent.change(title, { target: { value: 'My new title' } }); api.mockRejectedValueOnce(new AccountApiError(409));
  fireEvent.click(screen.getByRole('button', { name: /Сохранить/ })); await screen.findByRole('alert'); expect(title).toHaveValue('My new title'); expect(JSON.parse(api.mock.calls.at(-1)![1].body).expected_updated_at).toBe(resume.updated_at); expect(mockPush).not.toHaveBeenCalled();
});
test('legacy JSON text collections and named skills load without losing editable entries', async () => {
  api.mockResolvedValue({ resume: { ...resume, skills: '["JS",{"name":"SQL"}]', experience_details: JSON.stringify(resume.experience_details), education: '[{"institution":"University","field":"IT","start_year":2020}]', education_level: 'higher' } });
  render(<EditResume />); await screen.findByLabelText('Название резюме'); expect(screen.getByDisplayValue('A')).toBeInTheDocument(); expect(screen.getByDisplayValue('University')).toBeInTheDocument(); expect(screen.getByText('SQL')).toBeInTheDocument();
});
test('an account change remounts and hides the previous private form; a late save cannot navigate', async () => {
  let finish: (value: any) => void = () => {}; const view = render(<NewResume />); await screen.findByLabelText('Название резюме'); api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); fireEvent.click(screen.getByRole('button', { name: 'Черновик' }));
  api.mockImplementation(() => new Promise(() => {})); mockUser = { id: 'B' }; view.rerender(<NewResume />); expect(screen.queryByLabelText('Название резюме')).not.toBeInTheDocument(); await act(async () => finish({ resume })); expect(mockPush).not.toHaveBeenCalled();
});
