'use client';

import { useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useLanguage } from '@/contexts/language-context';
import { RoleSelection } from './role-selection';
import { JobSeekerAuth } from './job-seeker-auth';
import { SmsVerification } from './sms-verification';
import { EmployerAuth } from './employer-auth';
import { PasswordCreate } from './password-create';
import { PasswordLogin } from './password-login';
import { RoleSelectLogin } from './role-select-login';
import { X, ArrowLeft } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';

export function AuthModal() {
    const { isOpen, closeModal, step, setStep, userRole } = useAuthModal();
    const { lang } = useLanguage();
    const previousFocus = useRef<HTMLElement | null>(null);

    const handleBack = useCallback(() => {
        if (step === 'sms') {
            setStep('auth');
        } else if (step === 'auth') {
            setStep('role');
        } else if (step === 'password_login') {
            setStep('auth');
        } else if (step === 'password_create') {
            // Can't go back from password create (after SMS verification)
        }
    }, [step, setStep]);

    const canGoBack = step === 'auth' || step === 'sms' || step === 'password_login';

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
          <Dialog.Portal>
            {/* Backdrop with blur */}
            <Dialog.Overlay
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            />

            {/* Modal Container */}
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl outline-none animate-in fade-in duration-300"
              onOpenAutoFocus={() => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
              onCloseAutoFocus={(event) => { if (previousFocus.current?.isConnected) { event.preventDefault(); previousFocus.current.focus(); } }}
            >
                <Dialog.Title className="sr-only">{lang === 'ru' ? 'Вход и регистрация' : 'Kirish va ro‘yxatdan o‘tish'}</Dialog.Title>
                <Dialog.Description className="sr-only">{lang === 'ru' ? 'Выберите роль и подтвердите вход в свой аккаунт.' : 'Rolni tanlang va akkauntingizga kirishni tasdiqlang.'}</Dialog.Description>
                {/* Glassmorphic Card */}
                <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/20 border border-white/50 overflow-clip">
                    {/* Decorative gradient orbs */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-sky-400/30 to-emerald-400/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-violet-400/20 to-sky-400/30 rounded-full blur-3xl" />

                    {/* Header */}
                    <div className="relative flex items-center justify-between p-5 pb-0">
                        {canGoBack ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleBack}
                                aria-label={lang === 'ru' ? 'Назад' : 'Orqaga'}
                                className="w-10 h-10 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Button>
                        ) : (
                            <div className="w-10" />
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={closeModal}
                            aria-label={lang === 'ru' ? 'Закрыть окно входа' : 'Kirish oynasini yopish'}
                            className="w-10 h-10 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-600" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="relative p-6 pt-2">
                        {step === 'role' && <RoleSelection />}
                        {step === 'auth' && userRole === 'seeker' && <JobSeekerAuth />}
                        {step === 'auth' && userRole === 'employer' && <EmployerAuth />}
                        {step === 'sms' && <SmsVerification />}
                        {step === 'password_create' && <PasswordCreate />}
                        {step === 'password_login' && <PasswordLogin />}
                        {step === 'role_select_login' && <RoleSelectLogin />}
                    </div>
                </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
    );
}
