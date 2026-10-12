import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EmployerStatisticsPageView } from '@/components/profile/employer-statistics';
import { accountApi, AccountApiError } from '@/lib/account-api';
let lang = 'ru', user: any = { id: 'account-a' };
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user, isLoading: false }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: jest.fn() }) }));
jest.mock('@/components/profile/profile-layout', () => ({ ProfileLayout: ({ children }: any) => <div>{children}</div> }));
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
const api = accountApi as jest.Mock;
const job = (id: string) => ({ id, title_ru: 'Вакансия ' + id, title_uz: 'Vakansiya ' + id, created_at: '2026-10-09T00:00:00Z', views: 20, applications: 3, available: true });
const first = (nextCursor: string | null = null) => ({ jobs: [job('one')], nextCursor, stats: { items: 1205, active: 1000, views: 2410, applications: 1800 } });
beforeEach(() => { jest.clearAllMocks(); lang = 'ru'; user = { id: 'account-a' }; });

test('guest cannot read statistics; an initial failure is distinct from an empty portfolio', async () => {
  user = null; const view = render(<EmployerStatisticsPageView />); expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument(); expect(api).not.toHaveBeenCalled();
  user = { id: 'account-a' }; api.mockRejectedValueOnce(new Error()).mockResolvedValueOnce(first()); view.rerender(<EmployerStatisticsPageView />);
  await screen.findByRole('alert'); expect(screen.queryByText('У вас пока нет вакансий.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Повторить загрузку')); await screen.findByText('Вакансия one');
  expect(within(screen.getByRole('region', { name: 'Всего вакансий' })).getByText('1 205', { collapseWhitespace: true })).toBeInTheDocument();
});

test('a failed second page retains totals/rows and retries the same cursor without double submission', async () => {
  let finish: any;
  api.mockResolvedValueOnce(first('one')).mockRejectedValueOnce(new Error()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<EmployerStatisticsPageView />); await screen.findByText('Вакансия one'); fireEvent.click(screen.getByText('Ещё вакансии'));
  await screen.findByRole('alert'); expect(screen.getByText('Вакансия one')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Повторить загрузку')); expect(screen.getByText('Загрузка…')).toBeDisabled(); fireEvent.click(screen.getByText('Загрузка…')); expect(api).toHaveBeenCalledTimes(3);
  await act(async () => finish({ jobs: [job('two')], nextCursor: null, stats: null })); expect(screen.getByText('Вакансия two')).toBeInTheDocument();
  expect(screen.getByText('Вакансия one')).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Всего вакансий' })).toHaveTextContent(/1\s205/);
  expect(api.mock.calls.slice(1).map(([url]) => url)).toEqual(['/api/account/vacancies/stats?before=one', '/api/account/vacancies/stats?before=one']);
});

test('account changes abort reads and immediately hide the old portfolio; late results cannot reappear', async () => {
  let finish: any;
  api.mockResolvedValueOnce(first('one')).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ jobs: [], nextCursor: null, stats: { items: 0, active: 0, views: 0, applications: 0 } });
  const view = render(<EmployerStatisticsPageView />); await screen.findByText('Вакансия one'); fireEvent.click(screen.getByText('Ещё вакансии'));
  const signal = api.mock.calls[1][1].signal; user = { id: 'account-b' }; view.rerender(<EmployerStatisticsPageView />);
  expect(signal.aborted).toBe(true); expect(screen.queryByText('Вакансия one')).not.toBeInTheDocument(); await screen.findByText('У вас пока нет вакансий.');
  await act(async () => finish({ jobs: [job('private')], nextCursor: null, stats: null })); expect(screen.queryByText('Вакансия private')).not.toBeInTheDocument();
});

test('language changes translate all loaded jobs without discarding data or refetching', async () => {
  api.mockResolvedValue(first()); const view = render(<EmployerStatisticsPageView />); await screen.findByText('Вакансия one');
  lang = 'uz'; view.rerender(<EmployerStatisticsPageView />); expect(screen.getByText('Vakansiya one')).toBeInTheDocument(); expect(screen.getByText('Vakansiyalar statistikasi')).toBeInTheDocument(); expect(api).toHaveBeenCalledTimes(1);
});

test.each([401, 403])('a %s continuation hides previously loaded private statistics', async status => {
  api.mockResolvedValueOnce(first('one')).mockRejectedValueOnce(new AccountApiError(status)); render(<EmployerStatisticsPageView />); await screen.findByText('Вакансия one');
  fireEvent.click(screen.getByText('Ещё вакансии')); await screen.findByRole('alert'); expect(screen.queryByText('Вакансия one')).not.toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Всего вакансий' })).not.toBeInTheDocument();
});

test('malformed successful totals display a retryable error instead of zero or an exception', async () => {
  api.mockResolvedValue({ jobs: [], nextCursor: null, stats: { items: 'unknown' } }); render(<EmployerStatisticsPageView />); await screen.findByRole('alert'); expect(screen.queryByText('У вас пока нет вакансий.')).not.toBeInTheDocument();
});

test('a removed cursor offers a fresh first page instead of repeating a permanently invalid continuation', async () => {
  api.mockResolvedValueOnce(first('one')).mockRejectedValueOnce(new AccountApiError(404)).mockResolvedValueOnce({ ...first(), jobs: [job('replacement')] });
  render(<EmployerStatisticsPageView />); await screen.findByText('Вакансия one'); fireEvent.click(screen.getByText('Ещё вакансии')); await screen.findByRole('alert');
  fireEvent.click(screen.getByText('Повторить загрузку')); await screen.findByText('Вакансия replacement'); expect(screen.queryByText('Вакансия one')).not.toBeInTheDocument();
  expect(api.mock.calls.map(([url]) => url)).toEqual(['/api/account/vacancies/stats', '/api/account/vacancies/stats?before=one', '/api/account/vacancies/stats']);
});
