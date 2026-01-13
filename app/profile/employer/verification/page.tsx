'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    BadgeCheck, Clock, Shield, Building2, ExternalLink, Key, AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function VerificationPage() {
    const { lang } = useLanguage();
    const searchParams = useSearchParams();
    const [isVerified, setIsVerified] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [comingSoonMethod, setComingSoonMethod] = useState<'oneid' | 'eri' | null>(null);

    // Check for success/error params
    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success === 'true') {
            setIsVerified(true);
            toast.success(lang === 'ru' ? 'Компания успешно верифицирована!' : 'Kompaniya muvaffaqiyatli tasdiqlandi!');
        }

        if (error) {
            const errorMessages: Record<string, { ru: string; uz: string }> = {
                'oneid_denied': { ru: 'Авторизация через OneID отменена', uz: 'OneID orqali avtorizatsiya bekor qilindi' },
                'eri_denied': { ru: 'Авторизация через ЭЦП отменена', uz: 'ERI orqali avtorizatsiya bekor qilindi' },
                'missing_params': { ru: 'Отсутствуют параметры', uz: 'Parametrlar topilmadi' },
                'invalid_state': { ru: 'Недействительная сессия', uz: 'Sessiya yaroqsiz' },
                'token_failed': { ru: 'Ошибка авторизации', uz: 'Avtorizatsiya xatosi' },
                'userinfo_failed': { ru: 'Не удалось получить данные', uz: "Ma'lumotlarni olishda xatolik" },
                'session_expired': { ru: 'Сессия истекла', uz: 'Sessiya tugadi' },
                'unknown': { ru: 'Неизвестная ошибка', uz: "Noma'lum xatolik" },
            };
            const msg = errorMessages[error] || errorMessages['unknown'];
            toast.error(lang === 'ru' ? msg.ru : msg.uz);
        }
    }, [searchParams, lang]);

    const benefits = [
        {
            icon: CheckCircle2,
            title: lang === 'ru' ? 'Знак доверия' : "Ishonchli deb belgilanadi",
            description: lang === 'ru' ? 'Ваши вакансии будут отмечены ✓' : 'Vakansiyalaringiz ✓ bilan belgilanadi',
        },
        {
            icon: Building2,
            title: lang === 'ru' ? 'Приоритет показа' : "Yuqoriroq ko'rsatiladi",
            description: lang === 'ru' ? 'Выше в результатах поиска' : "Qidiruv natijalarida yuqoriroq",
        },
        {
            icon: Shield,
            title: lang === 'ru' ? 'Больше откликов' : "Ko'proq ariza",
            description: lang === 'ru' ? 'Кандидаты доверяют больше' : "Nomzodlar ko'proq ishonadi",
        },
    ];

    const handleVerification = (method: 'oneid' | 'eri') => {
        // For now show "coming soon" since APIs aren't configured
        setComingSoonMethod(method);
        setShowComingSoon(true);
    };

    // Success state
    if (isVerified) {
        return (
            <ProfileLayout userType="employer" userName="Kompaniya">
                <div className="space-y-6">
                    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
                        <CardContent className="py-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                <BadgeCheck className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Компания верифицирована!' : 'Kompaniya tasdiqlandi!'}
                            </h1>
                            <p className="text-slate-600 max-w-md mx-auto">
                                {lang === 'ru'
                                    ? 'Ваша компания успешно прошла верификацию. Теперь ваши вакансии будут отмечены значком верификации.'
                                    : "Kompaniyangiz muvaffaqiyatli tasdiqdan o'tdi. Endi vakansiyalaringiz tasdiqlash belgisi bilan belgilanadi."}
                            </p>
                            <Badge className="mt-6 bg-emerald-100 text-emerald-700 px-4 py-2">
                                <BadgeCheck className="w-4 h-4 mr-1" />
                                {lang === 'ru' ? 'Верифицировано' : 'Tasdiqlangan'}
                            </Badge>
                        </CardContent>
                    </Card>
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="employer" userName="Kompaniya">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {lang === 'ru' ? 'Верификация компании' : 'Kompaniyani tasdiqlash'}
                        </h1>
                        <p className="text-slate-500">
                            {lang === 'ru' ? 'Подтвердите легальность через государственные сервисы' : "Davlat xizmatlari orqali tasdiqlang"}
                        </p>
                    </div>
                </div>

                {/* Benefits */}
                <Card className="border-violet-100 bg-violet-50/30">
                    <CardContent className="py-6">
                        <div className="grid md:grid-cols-3 gap-4">
                            {benefits.map((benefit, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                                        <benefit.icon className="w-4 h-4 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{benefit.title}</p>
                                        <p className="text-sm text-slate-500">{benefit.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Verification Methods */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {lang === 'ru' ? 'Выберите способ верификации' : 'Tasdiqlash usulini tanlang'}
                        </CardTitle>
                        <CardDescription>
                            {lang === 'ru'
                                ? 'Используйте государственные сервисы для мгновенной верификации'
                                : "Tezkor tasdiqlash uchun davlat xizmatlaridan foydalaning"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* OneID */}
                        <div className="p-6 border-2 border-slate-200 rounded-xl hover:border-sky-300 hover:bg-sky-50/50 transition-all cursor-pointer group"
                            onClick={() => handleVerification('oneid')}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                                        <span className="text-white font-bold text-xl">ID</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 text-lg">OneID orqali tasdiqlash</h3>
                                        <p className="text-slate-500 text-sm">
                                            {lang === 'ru'
                                                ? 'Единая система идентификации государственных услуг'
                                                : "Davlat xizmatlari yagona identifikatsiya tizimi"}
                                        </p>
                                    </div>
                                </div>
                                <Button className="bg-sky-500 hover:bg-sky-600 gap-2 group-hover:scale-105 transition-transform">
                                    {lang === 'ru' ? 'Подтвердить' : 'Tasdiqlash'}
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* ERI */}
                        <div className="p-6 border-2 border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer group"
                            onClick={() => handleVerification('eri')}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <Key className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 text-lg">ERI kaliti orqali tasdiqlash</h3>
                                        <p className="text-slate-500 text-sm">
                                            {lang === 'ru'
                                                ? 'Электронная цифровая подпись (ЭЦП)'
                                                : "Elektron raqamli imzo kaliti orqali"}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 gap-2 group-hover:scale-105 transition-transform">
                                    {lang === 'ru' ? 'Подтвердить' : 'Tasdiqlash'}
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                {/* Coming Soon Modal */}
                {showComingSoon && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowComingSoon(false)}>
                        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" onClick={e => e.stopPropagation()}>
                            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Скоро будет доступно' : 'Tez orada ishga tushadi'}
                            </h3>
                            <p className="text-slate-600 mb-6">
                                {comingSoonMethod === 'oneid'
                                    ? (lang === 'ru' ? 'Интеграция с OneID находится в разработке.' : 'OneID integratsiyasi ishlab chiqilmoqda.')
                                    : (lang === 'ru' ? 'Интеграция с ЭЦП находится в разработке.' : 'ERI integratsiyasi ishlab chiqilmoqda.')}
                                {' '}
                                {lang === 'ru' ? 'Пожалуйста, подождите.' : 'Iltimos, biroz kuting.'}
                            </p>
                            <Button onClick={() => setShowComingSoon(false)} className="w-full">
                                {lang === 'ru' ? 'Понятно' : 'Tushunarli'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </ProfileLayout>
    );
}
