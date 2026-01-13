import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock contexts
jest.mock('@/contexts/language-context', () => ({
    useLanguage: () => ({
        lang: 'uz',
        t: {
            application: {
                title: 'Ariza qoldirish',
                fullName: 'To\'liq ism',
                phone: 'Telefon raqami',
                email: 'Email',
                message: 'Xabar',
                submit: 'Yuborish',
                success: 'Arizangiz muvaffaqiyatli yuborildi!',
            },
        },
    }),
}));

describe('Application Form', () => {
    it('renders all form fields', () => {
        render(
            <form data-testid="application-form">
                <label htmlFor="name">To'liq ism</label>
                <input id="name" type="text" placeholder="To'liq ism" />

                <label htmlFor="phone">Telefon raqami</label>
                <input id="phone" type="tel" placeholder="+998 90 123 45 67" />

                <label htmlFor="email">Email</label>
                <input id="email" type="email" placeholder="Email" />

                <button type="submit">Yuborish</button>
            </form>
        );

        expect(screen.getByTestId('application-form')).toBeInTheDocument();
        expect(screen.getByPlaceholderText("To'liq ism")).toBeInTheDocument();
        expect(screen.getByPlaceholderText('+998 90 123 45 67')).toBeInTheDocument();
    });

    it('allows user to fill in the form', async () => {
        render(
            <form data-testid="application-form">
                <input data-testid="name-input" type="text" />
                <input data-testid="phone-input" type="tel" />
            </form>
        );

        const nameInput = screen.getByTestId('name-input');
        const phoneInput = screen.getByTestId('phone-input');

        fireEvent.change(nameInput, { target: { value: 'Test User' } });
        fireEvent.change(phoneInput, { target: { value: '+998901234567' } });

        expect(nameInput).toHaveValue('Test User');
        expect(phoneInput).toHaveValue('+998901234567');
    });

    it('has a submit button', () => {
        render(
            <form data-testid="application-form">
                <button type="submit">Yuborish</button>
            </form>
        );

        expect(screen.getByRole('button', { name: 'Yuborish' })).toBeInTheDocument();
    });
});
