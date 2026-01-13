'use client';

import { useEffect, useCallback } from 'react';
import { useAuthModal } from '@/contexts/auth-modal-context';
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

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, closeModal]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={closeModal}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Glassmorphic Card */}
                <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/20 border border-white/50 overflow-hidden">
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
            </div>
        </div>
    );
}
