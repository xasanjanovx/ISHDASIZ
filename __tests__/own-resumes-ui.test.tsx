import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OwnResumesPage } from '@/components/profile/own-resumes';
import { accountApi, AccountApiError } from '@/lib/account-api';
let mockUser: any;
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: mockUser, isLoading: false }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: jest.fn() }) }));
jest.mock('@/components/profile/profile-layout', () => ({ ProfileLayout: ({ children }: any) => <div>{children}</div> }));
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
const api = accountApi as jest.Mock;
const resume = { id: 'one', title: 'My resume', full_name: 'Candidate', status: 'active', is_public: true, updated_at: '2026-10-07T00:00:00.123456Z', supports_found_job: true, regions: { name_ru: 'Ташкент' } };
beforeEach(() => { jest.clearAllMocks(); mockUser = { id: 'A' }; api.mockResolvedValue({ resumes: [resume], nextCursor: null }); });
test('a failed list load does not show a false empty account and can be retried', async () => {
  api.mockRejectedValueOnce(new AccountApiError(503)); render(<OwnResumesPage />); await screen.findByRole('alert'); expect(screen.queryByText('Резюме пока нет')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); await screen.findByText('My resume'); expect(screen.getByText('Ташкент')).toBeInTheDocument();
});
test('visibility remains confirmed after a failed write and the double click is locked', async () => {
  let reject: (value: any) => void = () => {}; render(<OwnResumesPage />); const toggle = await screen.findByRole('switch', { name: 'Публикация: My resume' }); api.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })); fireEvent.click(toggle); fireEvent.click(toggle);
  expect(api.mock.calls.filter(([, init]) => init?.method)).toHaveLength(1); expect(toggle).toBeChecked(); await act(async () => reject(new AccountApiError(503))); await screen.findByRole('alert'); expect(toggle).toBeChecked(); expect(toggle).toBeEnabled();
});
test('archive is confirmed, preserves the card on failure, and restores the saved version as a draft', async () => {
  render(<OwnResumesPage />); fireEvent.click(await screen.findByRole('button', { name: 'Удалить' })); const dialog = await screen.findByRole('alertdialog'); api.mockRejectedValueOnce(new AccountApiError(503)); fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить резюме' })); await within(dialog).findByRole('alert'); expect(dialog).toBeInTheDocument();
  api.mockResolvedValueOnce({ resume: { ...resume, status: 'archived', is_public: false, updated_at: '2026-10-07T01:00:00Z' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить резюме' })); await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()); expect(screen.queryByText('My resume')).not.toBeInTheDocument();
  api.mockResolvedValueOnce({ resume: { ...resume, status: 'draft', is_public: false } }); fireEvent.click(screen.getByRole('button', { name: 'Восстановить как черновик' })); await screen.findByText('My resume'); expect(screen.getByText('Черновик')).toBeInTheDocument(); expect(JSON.parse(api.mock.calls.at(-1)![1].body).expected_updated_at).toBe('2026-10-07T01:00:00Z');
});
test('the old schema hides the unavailable found-job action while other actions remain usable', async () => {
  api.mockResolvedValue({ resumes: [{ ...resume, supports_found_job: false }], nextCursor: null }); render(<OwnResumesPage />); await screen.findByText('My resume'); expect(screen.queryByRole('button', { name: 'Нашёл работу' })).not.toBeInTheDocument(); expect(screen.getByRole('switch')).toBeEnabled();
});
