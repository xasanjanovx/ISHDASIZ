'use client';

import { useState } from 'react';
import { formatLocalPhone } from '@/lib/phone-input';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Fingerprint, Info, Loader2 } from '@/components/ui/icons';
import { toast } from 'sonner';

export function JobSeekerAuth() {
    const { setStep, phoneNumber, setPhoneNumber, setIsNewUser } = useAuthModal();
    const { lang } = useLanguage();
    const [phone, setPhone] = useState(phoneNumber);
    const [isLoading, setIsLoading] = useState(false);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatLocalPhone(e.target.value);
        setPhone(formatted);
    };

    const handleContinue = async () => {
        if (phone.replace(/\D/g, '').length === 9) {
            setIsLoading(true);
            const fullPhone = `+998${phone.replace(/\D/g, '')}`;

            try {
                // First check if user exists
                const checkRes = await fetch('/api/auth/check-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: fullPhone })
                });

                const checkData = await checkRes.json();

                if (!checkRes.ok || typeof checkData.exists !== 'boolean' || typeof checkData.hasPassword !== 'boolean') {
                    toast.error(checkData.error || (lang === 'ru' ? 'Не удалось проверить аккаунт. Повторите.' : 'Akkauntni tekshirib bo‘lmadi. Qayta urinib ko‘ring.'));
                    return;
                }
                // Password entry includes SMS recovery even when password attempts are locked.
                setPhoneNumber(phone);

                if (checkData.exists && checkData.hasPassword) {
                    // User exists with password - go to password login
                    setIsNewUser(false);
                    setStep('password_login');
                } else {
                    // New user or user without password - send SMS
                    setIsNewUser(!checkData.exists);

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

                    // Show dev code if available
                    if (data.dev_code) {
                        toast.info(`🔧 Dev kod: ${data.dev_code}`);
                    }

                    setStep('sms');
                }
            } catch (err) {
                console.error(err);
                toast.error(lang === 'ru' ? 'Ошибка сети' : 'Tarmoq xatosi');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const isPhoneValid = phone.replace(/\D/g, '').length === 9;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-foreground">
                    {lang === 'ru' ? 'Вход для соискателя' : 'Ish qidiruvchi sifatida kirish'}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {lang === 'ru' ? 'Введите номер телефона' : 'Telefon raqamingizni kiriting'}
                </p>
            </div>

            {/* Notice */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                    {lang === 'ru'
                        ? 'Если вы уже зарегистрированы, вы войдёте по паролю. Новые пользователи получат SMS.'
                        : "Agar ro'yxatdan o'tgan bo'lsangiz, parol bilan kirasiz. Yangi foydalanuvchilar SMS oladi."}
                </p>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
                <Label htmlFor="seeker-login-phone" className="text-sm font-medium text-foreground">
                    {lang === 'ru' ? 'Номер телефона' : 'Telefon raqami'}
                </Label>
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground font-medium pointer-events-none text-sm">
                        <span>🇺🇿</span>
                        <span>+998</span>
                    </div>
                    <Input
                        id="seeker-login-phone"
                        autoComplete="tel-national"
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="91 234-56-78"
                        className="pl-20 h-12 text-base font-medium rounded-xl border-border focus:border-border focus:ring-emerald-500/20"
                        autoFocus
                    />
                </div>
            </div>

            {/* Continue Button */}
            <Button
                onClick={handleContinue}
                disabled={!isPhoneValid || isLoading}
                className={`
                    w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300
                    ${isPhoneValid
                        ? 'bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary shadow-lg shadow-primary/25'
                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                    }
                `}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{lang === 'ru' ? 'Проверка...' : 'Tekshirilmoqda...'}</span>
                    </div>
                ) : (
                    <>
                        <Send className="w-4 h-4 mr-2" />
                        <span>{lang === 'ru' ? 'Продолжить' : 'Davom etish'}</span>
                    </>
                )}
            </Button>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-card text-muted-foreground">
                        {lang === 'ru' ? 'или' : 'yoki'}
                    </span>
                </div>
            </div>

            {/* OneID - Recommended */}
            <div className="space-y-2">
                <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl border-border bg-accent hover:bg-accent hover:border-border transition-all group"
                    onClick={() => toast.info(lang === 'ru' ? 'OneID в разработке' : 'OneID ishlab chiqilmoqda')}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <Fingerprint className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <span className="font-semibold text-sm text-foreground">{lang === 'ru' ? 'Вход через OneID' : 'OneID orqali kirish'}</span>
                            <p className="text-xs text-muted-foreground">
                                {lang === 'ru' ? 'Скоро будет доступен' : 'Tez orada mavjud bo‘ladi'}
                            </p>
                        </div>
                    </div>
                </Button>
            </div>
        </div>
    );
}
