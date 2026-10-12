import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthModal } from '@/components/auth/auth-modal';

const mockClose = jest.fn();
const mockSetStep = jest.fn();
let mockStep = 'role';
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ isOpen: true, closeModal: mockClose, step: mockStep, setStep: mockSetStep, userRole: 'seeker' }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/components/auth/role-selection', () => ({ RoleSelection: () => <button>Выбрать роль</button> }));
jest.mock('@/components/auth/job-seeker-auth', () => ({ JobSeekerAuth: () => <><label htmlFor="phone">Номер телефона</label><input id="phone" /><button>Продолжить</button></> }));
jest.mock('@/components/auth/employer-auth', () => ({ EmployerAuth: () => null }));
jest.mock('@/components/auth/sms-verification', () => ({ SmsVerification: () => null }));
jest.mock('@/components/auth/password-create', () => ({ PasswordCreate: () => null }));
jest.mock('@/components/auth/password-login', () => ({ PasswordLogin: () => null }));
jest.mock('@/components/auth/role-select-login', () => ({ RoleSelectLogin: () => null }));
beforeEach(() => { jest.clearAllMocks(); mockStep = 'role'; });

test('the dialog is named and background navigation is hidden from assistive technology', () => {
  render(<><button>Background navigation</button><AuthModal /></>);
  expect(screen.getByRole('dialog', { name: 'Вход и регистрация' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Background navigation' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Закрыть окно входа' })).toBeInTheDocument();
});
test('Tab stays inside the modal and Escape requests closing', async () => {
  render(<AuthModal />);
  const last = screen.getByRole('button', { name: 'Выбрать роль' });
  const first = screen.getByRole('button', { name: 'Закрыть окно входа' });
  last.focus(); fireEvent.keyDown(last, { key: 'Tab' });
  await waitFor(() => expect(first).toHaveFocus());
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: 'Escape' });
  expect(mockClose).toHaveBeenCalledTimes(1);
});
test('the back button returns to role selection and long forms have a scrollable viewport', () => {
  mockStep = 'auth'; render(<AuthModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  expect(mockSetStep).toHaveBeenCalledWith('role');
  expect(screen.getByRole('dialog')).toHaveClass('overflow-y-auto', 'max-h-[calc(100dvh-2rem)]');
});
