import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminLogin from '@/app/admin/login/page';
import AdminReset from '@/app/admin/reset-password/page';
const mockReset = jest.fn(), mockGetUser = jest.fn(), mockUpdate = jest.fn(), mockSignIn = jest.fn();
jest.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ loading: false, user: null, adminProfile: null, error: null, signIn: mockSignIn }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru', t: { admin: { email: 'Email', password: 'Пароль', login: 'Войти', loginTitle: 'Администратор' } } }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { resetPasswordForEmail: (...args: any[]) => mockReset(...args), getUser: (...args: any[]) => mockGetUser(...args), updateUser: (...args: any[]) => mockUpdate(...args) } } }));
beforeEach(() => { jest.clearAllMocks(); mockReset.mockResolvedValue({ error: null }); mockGetUser.mockResolvedValue({ data: { user: { id: 'admin' } }, error: null }); mockUpdate.mockResolvedValue({ error: null }); });
test('email recovery is explicit and never submits the old password', async () => {
  render(<AdminLogin />);
  fireEvent.click(screen.getByRole('button', { name: 'Забыли пароль?' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
  await waitFor(() => expect(mockReset).toHaveBeenCalledWith('owner@example.test', { redirectTo: 'http://localhost/admin/reset-password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Проверьте почту');
  expect(mockSignIn).not.toHaveBeenCalled();
});
test('reset validates a real session and saves only matching sufficiently long passwords', async () => {
  render(<AdminReset />);
  const input = await screen.findByLabelText('Новый пароль');
  fireEvent.change(input, { target: { value: 'a-long-new-password' } });
  fireEvent.change(screen.getByLabelText('Повторите пароль'), { target: { value: 'different-password' } });
  expect(screen.getByRole('button', { name: 'Сохранить пароль' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Повторите пароль'), { target: { value: 'a-long-new-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ password: 'a-long-new-password' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Пароль изменён');
});
test('an expired recovery session cannot change a password', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });
  render(<AdminReset />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Ссылка недействительна');
  expect(screen.queryByLabelText('Новый пароль')).not.toBeInTheDocument();
  expect(mockUpdate).not.toHaveBeenCalled();
});
