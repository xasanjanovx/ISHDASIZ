import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { JobSeekerAuth } from '@/components/auth/job-seeker-auth';
import { EmployerAuth } from '@/components/auth/employer-auth';
import { formatUzPhoneInput } from '@/lib/phone-input';
import { toast } from 'sonner';

const mockSetStep = jest.fn();
const mockSetPhone = jest.fn();
const mockSetNew = jest.fn();
let mockLang = 'ru';
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({
    setStep: mockSetStep, phoneNumber: '', setPhoneNumber: mockSetPhone, setIsNewUser: mockSetNew,
}) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: mockLang }) }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), info: jest.fn() } }));
const mockFetch = jest.fn();
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => { jest.clearAllMocks(); mockFetch.mockReset(); global.fetch = mockFetch; mockLang = 'ru'; });

test.each(['+998 (90) 123-45-67', '998901234567', '90 123-45-67'])('formats %s without changing its identity', value => {
    expect(formatUzPhoneInput(value)).toBe('90 123-45-67');
});
test.each(['+79012345678', '9012345678', '9989012345678', '998123456'])('does not silently drop digits from %s', value => {
    expect(formatUzPhoneInput(value).replace(/\D/g, '')).toBe(value.replace(/\D/g, ''));
});

describe.each([['seeker', JobSeekerAuth], ['employer', EmployerAuth]] as const)('%s phone sign-in', (_role, Auth) => {
    const fill = (value = '+998 (90) 123-45-67') => {
        const view = render(<Auth />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Номер телефона' }), { target: { value } });
        return view.container.querySelector('form')!;
    };
    test('a pasted full number and form submission reach the existing password flow', async () => {
        mockFetch.mockResolvedValue(reply({ exists: true, hasPassword: true, locked: false }));
        fireEvent.submit(fill());
        await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('password_login'));
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ phone: '+998901234567' });
        expect(mockSetPhone).toHaveBeenCalledWith('90 123-45-67');
        expect(mockSetNew).toHaveBeenCalledWith(false);
    });
    test.each([
        ['unavailable database', { exists: false, hasPassword: false, locked: false, error: 'Service unavailable' }, false],
        ['malformed success', {}, true],
        ['locked account', { exists: true, hasPassword: true, locked: true }, true],
    ])('stops at %s without sending SMS or changing the step', async (_name, body, ok) => {
        mockFetch.mockResolvedValue(reply(body, ok));
        fireEvent.submit(fill());
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.any(String)));
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockSetPhone).not.toHaveBeenCalled();
        expect(mockSetStep).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Продолжить' })).toBeEnabled();
    });
    test('only a confirmed new account proceeds through successful SMS delivery', async () => {
        mockFetch.mockResolvedValueOnce(reply({ exists: false, hasPassword: false, locked: false }))
            .mockResolvedValueOnce(reply({ success: true }));
        fireEvent.submit(fill());
        await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('sms'));
        expect(mockFetch.mock.calls.map(call => call[0])).toEqual(['/api/auth/check-user', '/api/auth/send-otp']);
        expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ phone: '+998901234567' });
        expect(mockSetNew).toHaveBeenCalledWith(true);
    });
    test('failed SMS delivery keeps the form available for retry', async () => {
        mockFetch.mockResolvedValueOnce(reply({ exists: true, hasPassword: false, locked: false }))
            .mockResolvedValueOnce(reply({ error: 'SMS unavailable' }, false));
        fireEvent.submit(fill());
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('SMS unavailable'));
        expect(mockSetStep).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Продолжить' })).toBeEnabled();
    });
    test.each(['+79012345678', '9012345678'])('cannot submit invalid or foreign number %s', value => {
        fireEvent.submit(fill(value));
        expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
        expect(mockFetch).not.toHaveBeenCalled();
    });
    test('ignores another submission while checking the account', async () => {
        let resolve!: (value: unknown) => void;
        mockFetch.mockReturnValue(new Promise(done => { resolve = done; }));
        const form = fill();
        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        resolve(reply({ exists: true, hasPassword: true, locked: false }));
        await waitFor(() => expect(mockSetStep).toHaveBeenCalledWith('password_login'));
    });
    test('alternative method buttons cannot submit the phone form', () => {
        fill();
        const buttons = screen.getAllByRole('button').filter(button => button.textContent !== 'Продолжить');
        expect(buttons.length).toBeGreaterThan(0);
        for (const button of buttons) expect(button).toHaveAttribute('type', 'button');
    });
    test('Uzbek lockout feedback remains understandable without a server message', async () => {
        mockLang = 'uz';
        mockFetch.mockResolvedValue(reply({ exists: true, hasPassword: true, locked: true }));
        const view = render(<Auth />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Telefon raqami' }), { target: { value: '901234567' } });
        fireEvent.submit(view.container.querySelector('form')!);
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Kirishga urinishlar juda ko‘p. Keyinroq urinib ko‘ring.'));
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});
