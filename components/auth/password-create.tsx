'use client';

import { useState } from 'react';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from '@/components/ui/icons';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { onboardingPath } from '@/lib/onboarding';

export function PasswordCreate() {
    const { phoneNumber, userRole, closeModal } = useAuthModal();
    const { login } = useUserAuth();
    const { lang } = useLanguage();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fullPhone = `+998${phoneNumber.replace(/\D/g, '')}`;
    const role = userRole === 'employer' ? 'employer' : 'job_seeker';
    const isPasswordValid = password.length >= 6;
    const doPasswordsMatch = password === confirmPassword;
    const canSubmit = isPasswordValid && doPasswordsMatch && confirmPassword.length > 0;

    const handleSubmit = async () => {
        if (!canSubmit || isLoading) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/create-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: fullPhone,
                    password,
                    role
                })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Xatolik yuz berdi');
                setIsLoading(false);
                return;
            }

            toast.success(lang === 'ru' ? 'Пароль создан!' : 'Parol yaratildi!');

            // Use login() from context to properly persist session
            login(data.user);

            closeModal();

            // Redirect to profile
            router.push(onboardingPath(role));

        } catch (error) {
            toast.error('Tarmoq xatosi');
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-lg shadow-primary/30">
                    <Lock className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                    {lang === 'ru' ? 'Создайте пароль' : 'Parol yarating'}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {lang === 'ru' ? 'Минимум 6 символов' : 'Kamida 6 ta belgi'}
                </p>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
                <Label>{lang === 'ru' ? 'Пароль' : 'Parol'}</Label>
                <div className="relative">
                    <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pr-10 h-12"
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                {password.length > 0 && password.length < 6 && (
                    <p className="text-xs text-red-500">
                        {lang === 'ru' ? 'Минимум 6 символов' : 'Kamida 6 ta belgi kerak'}
                    </p>
                )}
                {isPasswordValid && (
                    <p className="text-xs text-primary flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {lang === 'ru' ? 'Пароль подходит' : 'Parol mos'}
                    </p>
                )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
                <Label>{lang === 'ru' ? 'Подтвердите пароль' : 'Parolni tasdiqlang'}</Label>
                <div className="relative">
                    <Input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pr-10 h-12"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    >
                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                {confirmPassword.length > 0 && !doPasswordsMatch && (
                    <p className="text-xs text-red-500">
                        {lang === 'ru' ? 'Пароли не совпадают' : 'Parollar mos kelmadi'}
                    </p>
                )}
                {confirmPassword.length > 0 && doPasswordsMatch && (
                    <p className="text-xs text-primary flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {lang === 'ru' ? 'Пароли совпадают' : 'Parollar mos'}
                    </p>
                )}
            </div>

            {/* Submit Button */}
            <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className={`
                    w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300
                    ${canSubmit
                        ? 'bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary shadow-lg shadow-primary/25'
                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                    }
                `}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{lang === 'ru' ? 'Создание...' : 'Yaratilmoqda...'}</span>
                    </div>
                ) : (
                    <span>{lang === 'ru' ? 'Продолжить' : 'Davom etish'}</span>
                )}
            </Button>
        </div>
    );
}
