'use client';

import { useState } from 'react';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Send, Fingerprint, Info, Key, Loader2 } from '@/components/ui/icons';
import { toast } from 'sonner';

export function EmployerAuth() {
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

    const handleOneIdClick = () => {
        toast.info(lang === 'ru' ? 'OneID интеграция в разработке' : 'OneID integratsiyasi ishlab chiqilmoqda');
    };

    const handleEriClick = () => {
        toast.info(lang === 'ru' ? 'ERI интеграция в разработке' : 'ERI integratsiyasi ishlab chiqilmoqda');
    };

    const isPhoneValid = phone.replace(/\D/g, '').length === 9;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-1">
                <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Building2 className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                    {lang === 'ru' ? 'Вход для работодателя' : 'Ish beruvchi sifatida kirish'}
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
                        ? 'После регистрации вы сможете верифицировать компанию через OneID или ERI.'
                        : "Ro'yxatdan o'tgandan so'ng kompaniyani OneID yoki ERI orqali tasdiqlashingiz mumkin."}
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
                        className="pl-20 h-12 text-base font-medium rounded-xl border-slate-200 focus:border-violet-500 focus:ring-violet-500/20"
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
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25'
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
                        {lang === 'ru' ? 'или войти через' : 'yoki orqali kirish'}
                    </span>
                </div>
            </div>

            {/* Alternative Auth Methods */}
            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    className="h-12 rounded-xl border-sky-200 bg-sky-50/50 hover:bg-sky-100 hover:border-sky-300"
                    onClick={handleOneIdClick}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center">
                            <Fingerprint className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-sm text-slate-700">OneID</span>
                    </div>
                </Button>
                <Button
                    variant="outline"
                    className="h-12 rounded-xl border-violet-200 bg-violet-50/50 hover:bg-violet-100 hover:border-violet-300"
                    onClick={handleEriClick}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center">
                            <Key className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-sm text-slate-700">ERI</span>
                    </div>
                </Button>
            </div>
        </div>
    );
}
