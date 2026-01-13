'use client';

import { useState } from 'react';
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

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '');
        const limited = digits.slice(0, 9);

        let formatted = '';
        if (limited.length > 0) formatted += limited.slice(0, 2);
        if (limited.length > 2) formatted += ' ' + limited.slice(2, 5);
        if (limited.length > 5) formatted += '-' + limited.slice(5, 7);
        if (limited.length > 7) formatted += '-' + limited.slice(7, 9);

        return formatted;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value);
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

                if (checkData.locked) {
                    toast.error(checkData.message);
                    setIsLoading(false);
                    return;
                }

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
                <h2 className="text-xl font-bold text-slate-900">
                    {lang === 'ru' ? 'Вход для соискателя' : 'Ish qidiruvchi sifatida kirish'}
                </h2>
                <p className="text-slate-500 text-sm">
                    {lang === 'ru' ? 'Введите номер телефона' : 'Telefon raqamingizni kiriting'}
                </p>
            </div>

            {/* Notice */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                    {lang === 'ru'
                        ? 'Если вы уже зарегистрированы, вы войдёте по паролю. Новые пользователи получат SMS.'
                        : "Agar ro'yxatdan o'tgan bo'lsangiz, parol bilan kirasiz. Yangi foydalanuvchilar SMS oladi."}
                </p>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                    {lang === 'ru' ? 'Номер телефона' : 'Telefon raqami'}
                </Label>
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-600 font-medium pointer-events-none text-sm">
                        <span>🇺🇿</span>
                        <span>+998</span>
                    </div>
                    <Input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="91 234-56-78"
                        className="pl-20 h-12 text-base font-medium rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
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
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                    <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-white text-slate-400">
                        {lang === 'ru' ? 'или' : 'yoki'}
                    </span>
                </div>
            </div>

            {/* OneID - Recommended */}
            <div className="space-y-2">
                <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl border-sky-200 bg-sky-50 hover:bg-sky-100 hover:border-sky-300 transition-all group"
                    onClick={() => toast.info(lang === 'ru' ? 'OneID в разработке' : 'OneID ishlab chiqilmoqda')}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center">
                            <Fingerprint className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <span className="font-semibold text-sm text-slate-900">OneID orqali kirish</span>
                            <p className="text-xs text-slate-500">
                                {lang === 'ru' ? 'Автозаполнение всех данных' : "Barcha ma'lumotlar avtomatik to'ldiriladi"}
                            </p>
                        </div>
                    </div>
                </Button>
            </div>
        </div>
    );
}
