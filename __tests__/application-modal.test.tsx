import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApplicationModal } from '@/components/jobs/application-modal';
import { accountApi, AccountApiError } from '@/lib/account-api';
import { toast } from 'sonner';
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: { id: 'A', phone: '+998901234567' } }) }));
const job = { id: 'job-a', title: 'Job A' };
const choice = { id: 'resume-a', title: 'Резюме A', experience_years: 2, updated_at: '2026-10-07' };
let resolvePost: (value: any) => void, rejectPost: (error: any) => void;
beforeEach(() => {
  jest.clearAllMocks();
  (accountApi as jest.Mock).mockImplementation((_url, init) => init?.method === 'POST'
    ? new Promise((resolve, reject) => { resolvePost = resolve; rejectPost = reject; })
    : Promise.resolve({ resumes: [choice] }));
});
async function select() { fireEvent.click(await screen.findByRole('radio', { name: /Резюме A/ })); }
test('double clicks submit once and only send the selected IDs and contact data', async () => {
  const close = jest.fn(); render(<ApplicationModal isOpen onClose={close} job={job} />); await select();
  const submit = screen.getByRole('button', { name: 'Отправить заявку' }); fireEvent.click(submit); fireEvent.click(submit);
  const posts = (accountApi as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts).toHaveLength(1); expect(JSON.parse(posts[0][1].body)).not.toHaveProperty('user_id');
  await act(async () => resolvePost({ application: { id: 'saved' } })); expect(close).toHaveBeenCalledTimes(1);
});
test('a failed submission preserves the selected resume and letter for retry', async () => {
  const close = jest.fn(); render(<ApplicationModal isOpen onClose={close} job={job} />); await select();
  fireEvent.change(screen.getByLabelText('Сопроводительное письмо'), { target: { value: 'My draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
  await act(async () => rejectPost(new AccountApiError(503)));
  expect(screen.getByLabelText('Сопроводительное письмо')).toHaveValue('My draft');
  expect(screen.getByRole('radio', { name: /Резюме A/ })).toBeChecked(); expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeEnabled();
});
test('an old submission cannot close a newly opened vacancy form', async () => {
  const close = jest.fn(); const view = render(<ApplicationModal isOpen onClose={close} job={job} />); await select();
  fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
  view.rerender(<ApplicationModal isOpen onClose={close} job={{ id: 'job-b', title: 'Job B' }} />);
  await screen.findByRole('radio', { name: /Резюме A/ });
  await act(async () => resolvePost({ application: { id: 'saved' } }));
  expect(close).not.toHaveBeenCalled(); expect(screen.getByRole('heading', { name: 'Job B' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Резюме A/ })).not.toBeChecked();
});
test('a resume loading error is shown with retry instead of an empty account', async () => {
  (accountApi as jest.Mock).mockRejectedValueOnce(new AccountApiError(503));
  render(<ApplicationModal isOpen onClose={jest.fn()} job={job} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить резюме');
  expect(screen.queryByText('У вас нет резюме')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Резюме A/ })).toBeInTheDocument());
});
