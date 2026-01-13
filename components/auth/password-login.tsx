'use client';

import { useState } from 'react';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from '@/components/ui/icons';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function PasswordLogin() {
    const {
        phoneNumber,
        userRole,
        setStep,
        closeModal,
        setIsPasswordReset,
        setProfileFlags,
        setPendingUserId
    } = useAuthModal();
    const { login } = useUserAuth();
    const { lang } = useLanguage();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

    const fullPhone = `+998${phoneNumber.replace(/\D/g, '')}`;
    const formattedPhone = `+998 ${phoneNumber}`;

    const handleSubmit = async () => {
        if (!password.trim()) return;

        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone, password, selectedRole: userRole })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.locked) {
                    setError(data.error);
                    setAttemptsRemaining(0);
                } else if (data.attemptsRemaining !== undefined) {
                    setError(data.error);
                    setAttemptsRemaining(data.attemptsRemaining);
                } else {
                    setError(data.error || 'Xatolik yuz berdi');
                }
                setPassword('');
                setIsLoading(false);
                return;
            }

            // Check if user has both profiles - need role selection
            if (data.needsRoleSelection) {
                setProfileFlags({
                    has_job_seeker_profile: data.user.has_job_seeker_profile,
                    has_employer_profile: data.user.has_employer_profile
                });
                setPendingUserId(data.user.id);
                setStep('role_select_login');
                setIsLoading(false);
                return;
            }

            // Success! Login with the role from API (which respects user's selection)
            toast.success(data.message || 'Muvaffaqiyatli kirdingiz!');

            // Use role from API - it already handles auto-creation and selection
            const activeRole = data.user.role;

            login({
                id: data.user.id,
                phone: data.user.phone,
                active_role: activeRole,
                has_job_seeker_profile: data.user.has_job_seeker_profile,
                has_employer_profile: data.user.has_employer_profile,
                full_name: data.user.full_name,
                company_name: data.user.company_name,
                is_verified: true
            });

            closeModal();

            // Redirect to profile based on role
            router.push(activeRole === 'employer' ? '/profile/employer' : '/profile/job-seeker');

        } catch (error) {
            setError('Tarmoq xatosi');
        }
        setIsLoading(false);
    };

    const handleForgotPassword = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || (lang === 'ru' ? 'Ошибка отправки SMS' : 'SMS yuborishda xatolik'));
                setIsLoading(false);
                return;
            }

            // Show dev code if available (only for development/testing if enabled on backend)
            if (data.dev_code) {
                toast.info(`🔧 Dev kod: ${data.dev_code}`);
            } else {
                toast.success(lang === 'ru' ? 'Код отправлен' : 'Kod yuborildi');
            }

            // Go to SMS step for password reset
            setIsPasswordReset(true);
            setStep('sms');
        } catch (error) {
            console.error(error);
            toast.error(lang === 'ru' ? 'Ошибка сети' : 'Tarmoq xatosi');
        }
        setIsLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && password.trim()) {
            handleSubmit();
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                    <Lock className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                    {lang === 'ru' ? 'Вход' : 'Kirish'}
                </h2>
                <p className="text-slate-500 text-sm">
                    {formattedPhone}
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-red-700">{error}</p>
                        {attemptsRemaining !== null && attemptsRemaining > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                                {lang === 'ru'
                                    ? `Осталось попыток: ${attemptsRemaining}`
                                    : `Qolgan urinishlar: ${attemptsRemaining}`}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Password Input */}
            <div className="space-y-2">
                <Label>{lang === 'ru' ? 'Пароль' : 'Parol'}</Label>
                <div className="relative">
                    <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="••••••••"
                        className="pr-10 h-12"
                        autoFocus
                        disabled={attemptsRemaining === 0}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Forgot Password */}
            <div className="text-center">
                <button
                    onClick={handleForgotPassword}
                    className="text-sm text-sky-600 hover:text-sky-700 hover:underline"
                >
                    {lang === 'ru' ? 'Забыли пароль?' : 'Parolni unutdingizmi?'}
                </button>
            </div>

            {/* Submit Button */}
            <Button
                onClick={handleSubmit}
                disabled={!password.trim() || isLoading || attemptsRemaining === 0}
                className={`
                    w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300
                    ${password.trim() && attemptsRemaining !== 0
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/25'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }
                `}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{lang === 'ru' ? 'Вход...' : 'Kirish...'}</span>
                    </div>
                ) : (
                    <span>{lang === 'ru' ? 'Войти' : 'Kirish'}</span>
                )}
            </Button>
        </div>
    );
}
