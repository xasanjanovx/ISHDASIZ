'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { CheckCircle2, RefreshCw, Edit3 } from '@/components/ui/icons';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function SmsVerification() {
    const { phoneNumber, userRole, closeModal, setStep, isNewUser, isPasswordReset } = useAuthModal();
    const { login } = useUserAuth();
    const { lang } = useLanguage();
    const router = useRouter();
    // 5-digit code
    const [code, setCode] = useState(['', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const canResend = timer === 0;
    const [needsRestoration, setNeedsRestoration] = useState(false);
    const requestLock = useRef(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Timer countdown
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    // Auto-focus first input
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);

        // Auto-focus next input
        if (value && index < 4) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
        const newCode = [...code];
        pasted.split('').forEach((char, i) => {
            if (i < 5) newCode[i] = char;
        });
        setCode(newCode);
        inputRefs.current[Math.min(pasted.length, 4)]?.focus();
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 5 || requestLock.current) return;
        requestLock.current = true;

        setIsLoading(true);
        const fullPhone = `+998${phoneNumber.replace(/\D/g, '')}`;
        const role = userRole === 'seeker' ? 'job_seeker' : 'employer';

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone, code: fullCode, role })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || (lang === 'ru' ? 'Неверный код' : "Noto'g'ri kod"));
                setIsLoading(false);
                return;
            }

            if (data.needsRestoration) { setNeedsRestoration(true); return; }
            // OTP verified successfully
            toast.success(lang === 'ru' ? 'Код подтверждён!' : 'Kod tasdiqlandi!');

            // Check if user needs to create password or this is a password reset
            if (isNewUser || isPasswordReset || !data.hasPassword) {
                // Go to password creation step
                setStep('password_create');
            } else {
                // User has password, log them in directly (this shouldn't normally happen)
                if (data.user) {
                    login(data.user);
                }
                closeModal();
                const profilePath = role === 'job_seeker' ? '/profile/job-seeker' : '/profile/employer';
                router.push(profilePath);
            }

        } catch (err) {
            console.error(err);
            toast.error(lang === 'ru' ? 'Ошибка проверки' : 'Tekshirishda xatolik');
            setIsLoading(false);
        } finally {
            requestLock.current = false;
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend || isLoading) return;
        setIsLoading(true);

        const fullPhone = `+998${phoneNumber.replace(/\D/g, '')}`;

        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Resend failed');
            } else {
                setTimer(60);
                setCode(['', '', '', '', '']);
                inputRefs.current[0]?.focus();
                toast.success(lang === 'ru' ? 'SMS отправлен снова' : 'SMS qayta yuborildi');
                // In dev mode, show the code
                if (data.dev_code) {
                    toast.info(`🔧 Dev kod: ${data.dev_code}`);
                }
            }
        } catch (err) {
            toast.error('Network error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditPhone = () => {
        setStep('auth');
    };

    const isCodeComplete = code.every((digit) => digit !== '');

    // Title based on context
    const getTitle = () => {
        if (isPasswordReset) {
            return lang === 'ru' ? 'Восстановление пароля' : 'Parolni tiklash';
        }
        return lang === 'ru' ? 'Введите код' : 'Kodni kiriting';
    };

    if (needsRestoration) return <div className="space-y-5">
        <h2 className="text-xl font-semibold">{lang==='ru'?'Восстановить аккаунт?':'Akkaunt tiklansinmi?'}</h2>
        <p className="text-slate-600">{lang==='ru'?'Номер подтверждён. Ваши профили и переписка сохранятся, а вакансии и резюме вернутся к прежним настройкам видимости.':'Raqam tasdiqlandi. Profillar va yozishmalar saqlanadi, vakansiyalar va rezyumelarning oldingi ko‘rinish sozlamalari qaytadi.'}</p>
        <Button disabled={isLoading} onClick={async()=>{
            if(requestLock.current)return;
            requestLock.current=true;setIsLoading(true);
            try {
                const role=userRole==='seeker'?'job_seeker':'employer';
                const response=await fetch('/api/auth/restore-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true,role})});
                const data=await response.json();
                if(!response.ok) { toast.error(lang==='ru'?'Восстановление не выполнено. Если код истёк, получите новый SMS.':'Tiklash bajarilmadi. Kod muddati tugagan bo‘lsa, yangi SMS oling.');return; }
                if(isPasswordReset || !data.hasPassword) { setStep('password_create');return; }
                login(data.user);closeModal();router.push(data.user.active_role==='employer'?'/profile/employer':'/profile/job-seeker');
            } catch { toast.error(lang==='ru'?'Ошибка соединения. Попробуйте ещё раз.':'Ulanishda xatolik. Qayta urinib ko‘ring.'); }
            finally {requestLock.current=false;setIsLoading(false);}
        }}>{isLoading?(lang==='ru'?'Восстанавливаем…':'Tiklanmoqda…'):(lang==='ru'?'Подтвердить восстановление':'Tiklashni tasdiqlash')}</Button>
        <Button variant="outline" disabled={isLoading} onClick={closeModal}>{lang==='ru'?'Оставить аккаунт закрытым':'Akkauntni yopiq qoldirish'}</Button>
        <Button variant="ghost" disabled={isLoading} onClick={()=>{setNeedsRestoration(false);setCode(['','','','','']);}}>{lang==='ru'?'Получить новый код':'Yangi kod olish'}</Button>
    </div>;
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                    {getTitle()}
                </h2>
                <p className="text-slate-500 text-sm">
                    {lang === 'ru' ? 'Код отправлен на номер' : 'Kod quyidagi raqamga yuborildi'}
                </p>

                {/* Phone number with edit button */}
                <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold text-slate-700">+998 {phoneNumber}</span>
                    <button
                        onClick={handleEditPhone}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <Edit3 className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* 5-Digit Code Input */}
            <div className="flex justify-center gap-3">
                {code.map((digit, index) => (
                    <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        className={`
                            w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-1
                            ${digit
                                ? 'border-emerald-500 bg-emerald-50 focus:ring-emerald-500/30'
                                : 'border-slate-200 bg-white focus:border-sky-500 focus:ring-sky-500/30'
                            }
                        `}
                    />
                ))}
            </div>

            {/* Verify Button */}
            <Button
                onClick={handleVerify}
                disabled={!isCodeComplete || isLoading}
                className={`
                    w-full h-14 rounded-xl font-semibold text-base transition-all duration-300
                    ${isCodeComplete
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }
                `}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{lang === 'ru' ? 'Проверка...' : 'Tekshirilmoqda...'}</span>
                    </div>
                ) : (
                    <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        <span>{lang === 'ru' ? 'Подтвердить' : 'Tasdiqlash'}</span>
                    </>
                )}
            </Button>

            {/* Resend Timer */}
            <div className="text-center">
                {canResend ? (
                    <button
                        onClick={handleResend}
                        className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>{lang === 'ru' ? 'Отправить повторно' : 'Qayta yuborish'}</span>
                    </button>
                ) : (
                    <p className="text-slate-500 text-sm">
                        {lang === 'ru'
                            ? `Отправить повторно через ${timer} сек`
                            : `Qayta yuborish: ${timer} soniya`}
                    </p>
                )}
            </div>


        </div>
    );
}
