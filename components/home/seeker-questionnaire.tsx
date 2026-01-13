'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSeekerPreferences } from '@/hooks/use-seeker-preferences';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/contexts/language-context';
import { getRegions } from '@/lib/regions';
import { Region } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
    MapPin, Briefcase, Wallet, ChevronRight,
    ChevronLeft, Loader2, Navigation
} from '@/components/ui/icons';

// Categories hardcoded (since no DB table exists)
const CATEGORIES = [
    { id: 'it', name_uz: 'IT va Texnologiyalar', name_ru: 'IT и Технологии' },
    { id: 'education', name_uz: 'Ta\'lim', name_ru: 'Образование' },
    { id: 'healthcare', name_uz: 'Sog\'liqni saqlash', name_ru: 'Здравоохранение' },
    { id: 'construction', name_uz: 'Qurilish', name_ru: 'Строительство' },
    { id: 'agriculture', name_uz: 'Qishloq xo\'jaligi', name_ru: 'Сельское хозяйство' },
    { id: 'manufacturing', name_uz: 'Ishlab chiqarish', name_ru: 'Производство' },
    { id: 'trade', name_uz: 'Savdo', name_ru: 'Торговля' },
    { id: 'transport', name_uz: 'Transport', name_ru: 'Транспорт' },
    { id: 'finance', name_uz: 'Moliya', name_ru: 'Финансы' },
    { id: 'tourism', name_uz: 'Turizm', name_ru: 'Туризм' },
    { id: 'services', name_uz: 'Xizmatlar', name_ru: 'Услуги' },
    { id: 'government', name_uz: 'Davlat xizmati', name_ru: 'Госслужба' },
    { id: 'other', name_uz: 'Boshqa', name_ru: 'Другое' },
];

type Step = 'district' | 'category' | 'salary' | 'geolocation';

const STEPS: Step[] = ['district', 'category', 'salary', 'geolocation'];

export function SeekerQuestionnaire() {
    const router = useRouter();
    const { lang } = useLanguage();
    const { role } = useUserRole();
    const { preferences, updatePreferences, isCompleted, isLoading: prefsLoading } = useSeekerPreferences();

    const [currentStep, setCurrentStep] = useState(0);
    const [geoLoading, setGeoLoading] = useState(false);

    // Local state for current answers
    const [regions, setRegions] = useState<Region[]>([]);
    const [selectedDistrict, setSelectedDistrict] = useState<string>('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSalary, setSelectedSalary] = useState<number>(0);

    // Fetch regions
    useEffect(() => {
        getRegions().then(setRegions);
    }, []);

    // Don't show if not seeker, already completed, or still loading
    if (prefsLoading) return null;
    if (role !== 'seeker') return null;
    if (isCompleted) return null;

    const step = STEPS[currentStep];

    const texts = {
        uz: {
            district: {
                title: 'Qaysi tumanda ish qidiryapsiz?',
                subtitle: 'Tumanni tanlang',
            },
            category: {
                title: 'Qaysi sohada ishlamoqchisiz?',
                subtitle: 'Bir yoki bir nechta sohani tanlang',
            },
            salary: {
                title: 'Qancha maosh kutasiz?',
                subtitle: 'Minimal oylik maosh',
                negotiable: 'Kelishiladi',
                million: 'mln',
            },
            geolocation: {
                title: 'Sizga eng yaqin ishlarni ko\'rsatishimiz uchun joylashuvingizni belgilang',
                button: 'Joylashuvni aniqlash',
            },
            next: 'Keyingi',
            back: 'Orqaga',
        },
        ru: {
            district: {
                title: 'В каком районе ищете работу?',
                subtitle: 'Выберите район',
            },
            category: {
                title: 'В какой сфере хотите работать?',
                subtitle: 'Выберите одну или несколько сфер',
            },
            salary: {
                title: 'Какую зарплату ожидаете?',
                subtitle: 'Минимальная месячная зарплата',
                negotiable: 'Договорная',
                million: 'млн',
            },
            geolocation: {
                title: 'Определите местоположение, чтобы показать ближайшие вакансии',
                button: 'Определить местоположение',
            },
            next: 'Далее',
            back: 'Назад',
        },
    };

    const t = lang === 'ru' ? texts.ru : texts.uz;

    const formatSalary = (value: number): string => {
        if (value === 0) return t.salary.negotiable;
        return `${(value / 1000000).toFixed(1)} ${t.salary.million}`;
    };

    const handleNext = () => {
        // Save current step data
        if (step === 'district') {
            updatePreferences({ districtId: selectedDistrict || undefined });
        } else if (step === 'category') {
            updatePreferences({ categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined });
        } else if (step === 'salary') {
            updatePreferences({ salaryMin: selectedSalary });
        }

        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleGeolocation = () => {
        if (!navigator.geolocation) {
            finishQuestionnaire();
            return;
        }

        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updatePreferences({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    geoPermission: 'granted',
                    completedAt: new Date().toISOString(),
                });
                setGeoLoading(false);
                router.push('/map');
            },
            () => {
                updatePreferences({
                    geoPermission: 'denied',
                    completedAt: new Date().toISOString(),
                });
                setGeoLoading(false);
                router.push('/map');
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    };

    const finishQuestionnaire = () => {
        updatePreferences({ completedAt: new Date().toISOString() });
        router.push('/map');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95 duration-300">
                <CardContent className="p-6 md:p-8">
                    {/* Progress */}
                    <div className="flex gap-1 mb-6">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`flex-1 h-1 rounded-full ${i <= currentStep ? 'bg-sky-500' : 'bg-slate-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* District Step */}
                    {step === 'district' && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-sky-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{t.district.title}</h3>
                                    <p className="text-sm text-slate-500">{t.district.subtitle}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {regions.map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setSelectedDistrict(d.id.toString())}
                                        className={`p-2 rounded-lg text-center text-sm transition-all ${selectedDistrict === d.id.toString()
                                            ? 'bg-sky-500 text-white'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                            }`}
                                    >
                                        {lang === 'ru' ? d.name_ru : d.name_uz}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Category Step */}
                    {step === 'category' && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <Briefcase className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{t.category.title}</h3>
                                    <p className="text-sm text-slate-500">{t.category.subtitle}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {CATEGORIES.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setSelectedCategories((prev) =>
                                                prev.includes(c.id)
                                                    ? prev.filter((id) => id !== c.id)
                                                    : [...prev, c.id]
                                            );
                                        }}
                                        className={`p-3 rounded-lg text-left text-sm transition-all ${selectedCategories.includes(c.id)
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                            }`}
                                    >
                                        {lang === 'ru' ? c.name_ru : c.name_uz}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Salary Step */}
                    {step === 'salary' && (
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{t.salary.title}</h3>
                                    <p className="text-sm text-slate-500">{t.salary.subtitle}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="text-center">
                                    <span className="text-3xl font-bold text-slate-900">
                                        {formatSalary(selectedSalary)}
                                    </span>
                                </div>

                                <div className="px-2">
                                    <Slider
                                        value={[selectedSalary]}
                                        onValueChange={(value) => setSelectedSalary(value[0])}
                                        max={15000000}
                                        min={0}
                                        step={500000}
                                        className="w-full"
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-slate-400 px-2">
                                    <span>{t.salary.negotiable}</span>
                                    <span>15 {t.salary.million}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Geolocation Step */}
                    {step === 'geolocation' && (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sky-100 flex items-center justify-center">
                                <Navigation className="w-8 h-8 text-sky-600" />
                            </div>
                            <p className="text-slate-700 mb-8 text-lg leading-relaxed">
                                {t.geolocation.title}
                            </p>
                            <Button
                                onClick={handleGeolocation}
                                disabled={geoLoading}
                                size="lg"
                                className="w-full"
                            >
                                {geoLoading ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <MapPin className="w-5 h-5 mr-2" />
                                )}
                                {t.geolocation.button}
                            </Button>
                        </div>
                    )}

                    {/* Navigation */}
                    {step !== 'geolocation' && (
                        <div className="flex gap-3 mt-6">
                            {currentStep > 0 && (
                                <Button variant="outline" onClick={handleBack} className="flex-1">
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    {t.back}
                                </Button>
                            )}
                            <Button onClick={handleNext} className="flex-1">
                                {t.next}
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
