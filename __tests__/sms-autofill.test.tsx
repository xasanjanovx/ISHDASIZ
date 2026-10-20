import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SmsVerification } from '@/components/auth/sms-verification';
import { formatLocalPhone } from '@/lib/phone-input';
const mockStep = jest.fn();
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ phoneNumber: '901234567', userRole: 'seeker', isNewUser: false, isPasswordReset: true, setStep: mockStep }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ login: jest.fn() }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); });
test('a full mobile autofill code fills all five fields and continues password recovery', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, hasPassword: true }) });
  render(<SmsVerification />);
  fireEvent.change(screen.getByLabelText('Цифра кода 1'), { target: { value: '54321' } });
  expect(screen.getAllByRole('textbox').map(input => (input as HTMLInputElement).value)).toEqual(['5', '4', '3', '2', '1']);
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
  await waitFor(() => expect(mockStep).toHaveBeenCalledWith('password_create'));
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).code).toBe('54321');
});
test('an expired code explains how to recover in the selected language', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ errorCode: 'otp_expired' }) });
  render(<SmsVerification />);
  fireEvent.change(screen.getByLabelText('Цифра кода 1'), { target: { value: '54321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Срок кода истёк');
  expect(mockStep).not.toHaveBeenCalled();
});
test('pasting the complete +998 number preserves the real nine-digit number', () => {
  expect(formatLocalPhone('+998 (93) 414-68-10')).toBe('93 414-68-10');
  expect(formatLocalPhone('934146810')).toBe('93 414-68-10');
});
