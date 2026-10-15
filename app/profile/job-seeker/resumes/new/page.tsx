'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { PageLoading } from '@/components/layout/page-loading';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LocationSelect } from '@/components/ui/location-select';
import { getDistrictById } from '@/lib/regions';
import {
    ArrowLeft, Save, Plus, Trash2, Briefcase, GraduationCap,
    Languages, User, Loader2, Tag, Wand2, X, CheckCircle2
} from '@/components/ui/icons';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { accountApi, AccountApiError } from '@/lib/account-api';
import { resumePayload, resumeErrorText, resumeSkills } from '@/lib/resume-api';
import { AccountGate } from '@/components/profile/account-gate';
import { LANGUAGES_LIST, EDUCATION_OPTIONS, GENDER_OPTIONS } from '@/lib/constants';
import { mapOsonishCategory } from '@/lib/mappers/osonish-mapper';
import { Category, District } from '@/types/database';

interface Experience {
    id: string;
    company: string;
    position: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    description: string;
}

interface Education {
    id: string;
    institution: string;
    degree: string;
    field: string;
    start_year: string;
    end_year: string;
}

interface Language {
    id: string;
    name: string;
    level: string;
}

interface OsonishField {
    id: string | number;
    title: string;
    title_uz?: string | null;
    title_ru?: string | null;
    vacancies_count?: number | null;
    category_id?: string | number | null;
    category_title?: string | null;
}

export default function NewResumePage() {
    return <Suspense fallback={<PageLoading />}><AccountGate><NewResumeContent /></AccountGate></Suspense>;
}

function NewResumeContent() {
    const { lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useUserAuth();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [saveError, setSaveError] = useState<unknown>(null);
    const [revision, setRevision] = useState(0);
    const alive = useRef(false);
    const saveLock = useRef(false);
    const errorNotice = useRef<HTMLDivElement | null>(null);
    useEffect(() => { if (saveError) errorNotice.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, [saveError]);
    const requestId = useRef<string | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

    // AI State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiUsageCount, setAiUsageCount] = useState(0);
    const MAX_AI_USES = 3;

    // Data for selects
    const [categories, setCategories] = useState<Category[]>([]);
    // const [districts, setDistricts] = useState<District[]>([]); // handled by LocationSelect
    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const [fields, setFields] = useState<OsonishField[]>([]);
    const [fieldQuery, setFieldQuery] = useState('');
    const [selectedField, setSelectedField] = useState<OsonishField | null>(null);
    const [fieldCategory, setFieldCategory] = useState<Category | null>(null);

    const [form, setForm] = useState({
        title: '',
        full_name: '',
        birth_date: '',
        phone: '',
        region_id: '',
        district_id: '',
        category_id: '',
        experience_level: 'no_experience',
        education_level: 'secondary',
        gender: 'male',
        salary_min: '',
        salary_max: '',
        salary_negotiable: false,
        about: '',
        is_visible: true,
        status: 'active',
        employment_type: 'full_time',
    });

    const [skills, setSkills] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState('');

    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [educations, setEducations] = useState<Education[]>([]);
    const [languages, setLanguages] = useState<Language[]>([]);

    const normalizeField = (value: string) => value
        .toLowerCase()
        .replace(/[\u2018\u2019\u02BC\u02BB`']/g, '')
        .replace(/[^a-z\u0400-\u04FF0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const filteredFields = useMemo(() => {
        if (!fields.length) return [];
        const query = normalizeField(fieldQuery);
        if (query.length < 3) return [];
        const scored = fields.map(field => {
            const title = normalizeField(field.title_uz || field.title_ru || field.title || '');
            let score = 0;
            if (query && title === query) score += 100;
            if (query && title.startsWith(query)) score += 60;
            if (query && title.includes(query)) score += 40;
            return { field, score };
        });
        const filtered = scored.filter(item => item.score > 0);
        filtered.sort((a, b) => b.score - a.score);
        return filtered.slice(0, 60).map(item => item.field);
    }, [fields, fieldQuery]);

    const handleFieldPick = (field: OsonishField) => {
        setSelectedField(field);
        const title = field.title_uz || field.title_ru || field.title || '';
        setFieldQuery(title);
        const mapped = mapOsonishCategory(field.category_title || title, null, form.title || '');
        let categoryId = mapped?.categoryId || '';
        if (!categoryId) {
            const norm = normalizeField(field.category_title || title);
            const match = categories.find(cat => {
                const uz = normalizeField(cat.name_uz || '');
                const ru = normalizeField(cat.name_ru || '');
                return (uz && (norm === uz || norm.includes(uz))) || (ru && (norm === ru || norm.includes(ru)));
            });
            if (match) categoryId = match.id;
        }
        setForm(prev => ({ ...prev, category_id: categoryId }));
        setFieldCategory(categories.find(cat => cat.id === categoryId) || null);
    };

useEffect(() => {
        const query = fieldQuery.trim();
        if (query.length < 3) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/osonish/fields?search=${encodeURIComponent(query)}`);
                const payload = await response.json().catch(() => ({ fields: [] }));
                if (!cancelled && Array.isArray(payload?.fields)) {
                    setFields(payload.fields);
                }
            } catch {
                // ignore transient search errors
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [fieldQuery]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const loadData = async () => {
            try {
                const [catsRes, payload] = await Promise.all([
                    supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz'),
                    accountApi<{ profile: any }>('/api/account/resumes/prefill', { signal: controller.signal })
                ]);
                if (catsRes.error) throw new AccountApiError(503);
                const data = payload.profile;
                if (!data) throw new AccountApiError(503);
                let regionId = data.region_id ? String(data.region_id) : '', districtId = data.district_id ? String(data.district_id) : '';
                if (!districtId && data.city && /^\d+$/.test(data.city)) districtId = data.city;
                if (districtId) {
                    const district = await getDistrictById(districtId);
                    if (district) regionId = String(district.region_id);
                }
                if (cancelled) return;
                setCategories(catsRes.data || []); setSelectedRegion(regionId);
                setForm(previous => ({ ...previous, full_name: data.full_name || '', birth_date: data.birth_date || '', phone: data.phone || '', about: data.about || '', gender: data.gender || 'any', region_id: regionId, district_id: districtId,
                    salary_min: data.expected_salary_min?.toString() || '', salary_max: data.expected_salary_max?.toString() || '' }));
                setSkills(resumeSkills(data.skills));
            } catch (error) { if (!cancelled) setLoadError(error); }
            finally { if (!cancelled) setLoading(false); }
        };
        void loadData();
        return () => { cancelled = true; controller.abort(); };
    }, [revision]);

    const handleSalaryChange = (value: string, type: 'min' | 'max') => {
        const numericValue = value.replace(/[^0-9]/g, '');
        setForm(prev => ({
            ...prev,
            [type === 'min' ? 'salary_min' : 'salary_max']: numericValue
        }));
    };

    const formatCurrency = (value: string) => {
        if (!value) return '';
        return new Intl.NumberFormat('uz-UZ').format(parseInt(value));
    };

    const addExperience = () => {
        setExperiences([...experiences, {
            id: crypto.randomUUID(),
            company: '', // Will be labeled "Ish joyi"
            position: '',
            start_date: '',
            end_date: '',
            is_current: false,
            description: '',
        }]);
    };
    const removeExperience = (id: string) => setExperiences(experiences.filter(e => e.id !== id));
    const updateExperience = (id: string, field: keyof Experience, value: any) => {
        setExperiences(experiences.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const addEducation = () => {
        setEducations(prev => [...prev, {
            id: crypto.randomUUID(),
            institution: '',
            degree: '',
            field: '',
            start_year: '',
            end_year: '',
        }]);
    };
    const removeEducation = (id: string) => setEducations(educations.filter(e => e.id !== id));
    const updateEducation = (id: string, field: keyof Education, value: any) => {
        setEducations(educations.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const addLanguage = () => {
        setLanguages(prev => [...prev, {
            id: crypto.randomUUID(),
            name: 'uzbek',
            level: 'intermediate',
        }]);
    };
    const removeLanguage = (id: string) => setLanguages(languages.filter(l => l.id !== id));
    const updateLanguage = (id: string, field: keyof Language, value: any) => {
        setLanguages(languages.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const addSkill = () => {
        if (newSkill.trim() && !skills.includes(newSkill.trim())) {
            setSkills([...skills, newSkill.trim()]);
            setNewSkill('');
        }
    };
    const removeSkill = (skill: string) => setSkills(skills.filter(s => s !== skill));

    const handleAIGenerate = async () => {
        if (aiUsageCount >= MAX_AI_USES) {
            toast.error(lang === 'ru' ? 'Лимит использования AI исчерпан' : 'AI limit tugadi');
            return;
        }
        if (!aiPrompt.trim()) {
            toast.error(lang === 'ru' ? 'Введите описание' : 'Tavsif yozing');
            return;
        }

        setAiGenerating(true);
        try {
            const res = await fetch('/api/ai/resume-helper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'parse_resume',
                    content: aiPrompt,
                    categories: categories.map(c => ({ id: c.id, name: c.name_uz })),
                    districts: [], // Districts handled by LocationSelect component
                })
            });
            const data = await res.json();
            if (!alive.current) return;

            if (data.success && data.result) {
                const resData = data.result;
                // AI updates fields, but NEVER overwrites personal info (Shaxsiy ma'lumotlar)
                // if they already have values from profile
                setForm(prev => ({
                    ...prev,
                    // These fields can always be updated by AI
                    title: resData.title || prev.title,
                    about: resData.about || prev.about,
                    salary_min: resData.salary_min || prev.salary_min,
                    salary_max: resData.salary_max || prev.salary_max,
                    category_id: resData.category_id || prev.category_id,
                    experience_level: resData.experience_level || prev.experience_level,
                    education_level: resData.education_level || prev.education_level,
                    // Personal info (Shaxsiy ma'lumotlar) - ONLY update if prev is empty
                    full_name: prev.full_name || resData.full_name || '',
                    phone: prev.phone || resData.phone || '',
                    birth_date: prev.birth_date || resData.birth_date || '',
                    gender: prev.gender || resData.gender || 'male',
                    district_id: prev.district_id || resData.district_id?.toString() || '',
                }));

                // Resolve AI region
                if (resData.district_id && !form.district_id) {
                    const dist = await getDistrictById(resData.district_id);
                    if (dist && dist.region_id) setSelectedRegion(dist.region_id.toString());
                }
                if (resData.skills && Array.isArray(resData.skills)) {
                    setSkills(prev => Array.from(new Set([...prev, ...resData.skills])));
                }

                // Process Languages from AI
                if (resData.languages && Array.isArray(resData.languages)) {
                    const langMap: Record<string, string> = {
                        'uzbek': 'uzbek', 'o\'zbek': 'uzbek', 'ozbek': 'uzbek', 'uz': 'uzbek',
                        'russian': 'russian', 'rus': 'russian', 'ru': 'russian', 'русский': 'russian',
                        'english': 'english', 'ingliz': 'english', 'en': 'english', 'английский': 'english',
                        'korean': 'korean', 'koreys': 'korean', 'kr': 'korean', 'ko': 'korean', 'корейский': 'korean',
                        'chinese': 'chinese', 'xitoy': 'chinese', 'cn': 'chinese', 'zh': 'chinese', 'китайский': 'chinese',
                        'german': 'german', 'nemis': 'german', 'de': 'german', 'немецкий': 'german',
                    };

                    const newLangs = resData.languages
                        .map((l: string) => {
                            const normalized = l.toLowerCase().trim();
                            // Try to find a match in the map keys
                            const key = Object.keys(langMap).find(k => normalized.includes(k));
                            return key ? langMap[key] : null;
                        })
                        .filter(Boolean) // Remove nulls
                        // Unique values
                        .filter((value: string | null, index: number, self: (string | null)[]) => self.indexOf(value) === index)
                        .map((val: string | null, i: number) => ({
                            id: `ai-${Date.now()}-${i}`,
                            name: val,
                            level: 'intermediate'
                        }));

                    setLanguages(prev => {
                        // Avoid duplicates with existing
                        const existingNames = new Set(prev.map(p => p.name));
                        const uniqueNew = newLangs.filter((n: any) => !existingNames.has(n.name));
                        return [...prev, ...uniqueNew];
                    });
                }

                // Add placeholder experience if years > 0 AND no details
                if (resData.experience_years_count > 0 && (!resData.experience_details || resData.experience_details.length === 0)) {
                    if (experiences.length === 0) {
                        setExperiences([{
                            id: crypto.randomUUID(),
                            company: '',
                            position: '',
                            start_date: '',
                            end_date: '',
                            is_current: false,
                            description: lang === 'ru' ? `Опыт работы: ${resData.experience_years_count} лет` : `Ish tajribasi: ${resData.experience_years_count} yil`,
                        }]);
                    }
                }

                setAiUsageCount(prev => prev + 1);
                toast.success(lang === 'ru' ? 'Данные заполнены AI' : 'Ma\'lumotlar AI tomonidan to\'ldirildi');
                setShowAIModal(false);
            } else {
                toast.error('AI Error');
            }
        } catch (e) {
            console.error(e);
            if (alive.current) toast.error(lang === 'ru' ? 'Не удалось заполнить резюме' : 'Rezyumeni to‘ldirib bo‘lmadi');
        } finally {
            setAiGenerating(false);
        }
    };


    const handleSubmit = async (isDraft = false) => {
        if (!user?.id || saveLock.current) return;
        saveLock.current = true; setSaving(true); setSaveError(null);
        try {
            const payload = resumePayload(form, skills, experiences, educations, languages, isDraft);
            requestId.current ||= crypto.randomUUID();
            await accountApi('/api/account/resumes', { method: 'POST', body: JSON.stringify({ ...payload, request_id: requestId.current }) });
            if (!alive.current) return;
            toast.success(lang === 'ru' ? 'Резюме сохранено' : 'Rezyume saqlandi');
            router.push('/profile/job-seeker/resumes');
        } catch (error) { if (alive.current) setSaveError(error); }
        finally { saveLock.current = false; if (alive.current) setSaving(false); }
    };

    if (loadError) return <ProfileLayout userType="job_seeker"><div role="alert" className="space-y-4 rounded-xl border border-rose-200 bg-card p-6"><p>{resumeErrorText(loadError, lang)}</p><Button type="button" onClick={() => { setLoadError(null); setLoading(true); setRevision(value => value + 1); }}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button><Button type="button" variant="outline" asChild><Link href="/profile/job-seeker/resumes">{lang === 'ru' ? 'Мои резюме' : 'Mening rezyumelarim'}</Link></Button></div></ProfileLayout>;

    if (loading) {
        return (
            <ProfileLayout userType="job_seeker" userName="Foydalanuvchi">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="job_seeker" userName={form.full_name || "Foydalanuvchi"}>

            {/* AI Modal */}
            {showAIModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl animate-in fade-in zoom-in duration-200">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                                    <Image src="/ai-sparkle.png" alt="AI" width={28} height={28} className="w-7 h-7 brightness-0 invert" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">{lang === 'ru' ? 'AI Помощник' : 'AI Yordamchi'}</CardTitle>
                                    <CardDescription className="text-base">{lang === 'ru' ? 'Опишите ваш опыт, и AI заполнит резюме' : 'Tajribangizni tasvirlab bering, AI rezyumeni to\'ldiradi'}</CardDescription>
                                </div>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setShowAIModal(false)}>
                                <X className="w-6 h-6" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <Textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder={lang === 'ru' ? 'Я работал бухгалтером 3 года, знаю 1С, Excel...' : 'Masalan: Men 3 yil hisobchi bo\'lib ishlaganman, 1C, Excel dasturlarini bilaman...'}
                                rows={8}
                                className="text-base p-4 border-border focus:border-primary transition-colors"
                            />
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm text-muted-foreground">
                                    {MAX_AI_USES - aiUsageCount} {lang === 'ru' ? 'попыток осталось' : 'ta imkoniyat qoldi'}
                                </span>
                                <Button type="button"
                                    onClick={handleAIGenerate}
                                    disabled={aiGenerating || !aiPrompt.trim()}
                                    className="bg-primary hover:bg-primary px-8 h-11 text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                                >
                                    {aiGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Image src="/ai-sparkle.png" alt="AI" width={20} height={20} className="w-5 h-5 mr-2" />}
                                    {lang === 'ru' ? 'Заполнить' : 'To\'ldirish'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8 pb-20">

                {/* Header with Title and AI Button */}
                <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                    {/* Left: Back and Title */}
                    <div className="flex items-center gap-4">
                        <Link href="/profile/job-seeker/resumes">
                            <Button type="button" variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold text-foreground whitespace-nowrap">
                            {lang === 'ru' ? 'Разместить резюме' : 'Rezyume joylash'}
                        </h1>
                    </div>

                    {/* AI Button next to Title */}
                    <Button type="button"
                        onClick={() => setShowAIModal(true)}
                        className="bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary gap-3 px-6 h-12 text-sm shadow-md text-white transition-all hover:scale-[1.02]"
                    >
                        <Image src="/ai-sparkle.png" alt="AI" width={20} height={20} className="w-5 h-5" />
                        <div className="flex flex-col items-start leading-tight text-left">
                            <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-card to-secondary">AI Yordamchi</span>
                            <span className="text-xs opacity-90 font-light">Sun&apos;iy intellekt yordamida to&apos;ldirish</span>
                        </div>
                    </Button>
                </div>

                {/* Main Form */}
                {!!saveError && <div ref={errorNotice} role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{resumeErrorText(saveError, lang)}</div>}
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column: Main Content (2 cols wide) */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Target & Salary Card (New Top Section) */}
                            <Card className="border-border shadow-sm">
                                <CardHeader className="bg-background/50 border-b border-border pb-4">
                                    <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                                        <Briefcase className="w-5 h-5 text-primary" />
                                        {lang === 'ru' ? 'Желаемая должность и Зарплата' : 'Istalgan lavozim va Maosh'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="space-y-2">
                                        <Label className="text-foreground font-semibold text-base">{lang === 'ru' ? 'Желаемая должность' : 'Istalgan lavozim'} <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder={lang === 'ru' ? 'Например: Бухгалтер' : 'Masalan: Hisobchi'}
                                            aria-label={lang === 'ru' ? 'Название резюме' : 'Rezyume nomi'} value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            className="h-12 text-lg border-border focus:border-primary"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-foreground font-medium">{lang === 'ru' ? 'Ожидаемая зарплата (UZS)' : 'Kutilayotgan maosh (UZS)'}</Label>

                                            {/* Kelishiladi Toggle Switch */}
                                            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border mb-2">
                                                <span className="text-sm font-medium text-foreground">
                                                    {lang === 'ru' ? 'Договорная' : 'Kelishiladi'}
                                                </span>
                                                <Switch
                                                    checked={form.salary_negotiable}
                                                    onCheckedChange={(checked: boolean) => setForm({ ...form, salary_negotiable: checked, salary_min: '', salary_max: '' })}
                                                />
                                            </div>

                                            {!form.salary_negotiable && (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-full">
                                                        <Input
                                                            placeholder="Min"
                                                            aria-label={lang === 'ru' ? 'Минимальная зарплата' : 'Eng kam maosh'} value={form.salary_min}
                                                            onChange={(e) => handleSalaryChange(e.target.value, 'min')}
                                                            className="h-11 pl-3 font-medium"
                                                        />
                                                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">
                                                            {formatCurrency(form.salary_min)}
                                                        </span>
                                                    </div>
                                                    <span className="text-muted-foreground">-</span>
                                                    <div className="relative w-full">
                                                        <Input
                                                            placeholder="Max"
                                                            aria-label={lang === 'ru' ? 'Максимальная зарплата' : 'Eng ko‘p maosh'} value={form.salary_max}
                                                            onChange={(e) => handleSalaryChange(e.target.value, 'max')}
                                                            className="h-11 pl-3 font-medium"
                                                        />
                                                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">
                                                            {formatCurrency(form.salary_max)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground font-medium">
                                                {lang === 'ru' ? 'Ближайшая профессия' : 'Lavozimga yaqin kasb'} <span className="text-red-500">*</span>
                                            </Label>
                                            <select aria-label={lang === 'ru' ? 'Сфера деятельности' : 'Faoliyat sohasi'} value={form.category_id} onChange={event => { const value = event.target.value; setForm(previous => ({ ...previous, category_id: value })); setFieldCategory(categories.find(category => category.id === value) || null); setSelectedField(null); }} className="w-full rounded-xl border border-border bg-card px-3 py-3">
                                                <option value="">{lang === 'ru' ? 'Выберите сферу деятельности' : 'Faoliyat sohasini tanlang'}</option>
                                                {categories.map(category => <option key={category.id} value={category.id}>{lang === 'ru' ? category.name_ru || category.name_uz : category.name_uz || category.name_ru}</option>)}
                                            </select>
                                            <Input
                                                value={fieldQuery}
                                                onChange={(e) => {
                                                    setFieldQuery(e.target.value);
                                                    setSelectedField(null);
                                                    setFieldCategory(null);
                                                    setForm(prev => ({ ...prev, category_id: '' }));
                                                }}
                                                placeholder={lang === 'ru' ? 'Введите название профессии' : 'Kasb nomini kiriting'}
                                                className="h-11"
                                            />
                                            {filteredFields.length > 0 && (!selectedField || normalizeField(fieldQuery) !== normalizeField(selectedField.title_uz || selectedField.title_ru || selectedField.title)) && (
                                                <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-sm">
                                                    {filteredFields.map(field => {
                                                        const label = field.title_uz || field.title_ru || field.title;
                                                        return (
                                                            <button
                                                                key={String(field.id)}
                                                                onClick={() => handleFieldPick(field)}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-background"
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {fieldCategory && (
                                                <p className="text-xs text-muted-foreground">
                                                    {lang === 'ru' ? 'Сфера:' : 'Soha:'} {lang === 'uz' ? fieldCategory.name_uz : fieldCategory.name_ru}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Basic Info & About */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <User className="w-5 h-5 text-primary" />
                                        {lang === 'ru' ? 'Личные данные' : 'Shaxsiy ma\'lumotlar'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground font-medium">{lang === 'ru' ? 'ФИО' : 'To\'liq ismingiz'} <span className="text-red-500">*</span></Label>
                                            <Input
                                                aria-label={lang === 'ru' ? 'ФИО' : 'To‘liq ism'} value={form.full_name}
                                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                                placeholder="Ism Familiya"
                                                className="h-11"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground font-medium">{lang === 'ru' ? 'Телефон' : 'Telefon raqam'} <span className="text-red-500">*</span></Label>
                                            <Input
                                                aria-label={lang === 'ru' ? 'Телефон' : 'Telefon'} value={form.phone}
                                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                                placeholder="+998 90 123 45 67"
                                                className="h-11"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-2">
                                        <div className="space-y-2">
                                            <LocationSelect
                                                selectedRegion={form.region_id}
                                                selectedDistrict={form.district_id}
                                                onRegionChange={(v) => {
                                                    setSelectedRegion(v);
                                                    setForm(prev => ({ ...prev, region_id: v, district_id: '' }));
                                                }}
                                                onDistrictChange={(v) => setForm(prev => ({ ...prev, district_id: v }))}
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground font-medium">{lang === 'ru' ? 'Дата рождения' : 'Tug\'ilgan sana'} <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="date"
                                                    aria-label={lang === 'ru' ? 'Дата рождения' : 'Tug‘ilgan sana'} value={form.birth_date}
                                                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                                                    className="h-11"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground font-medium">{lang === 'ru' ? 'Пол' : 'Jinsi'}</Label>
                                                <Select value={form.gender} onValueChange={(val) => setForm({ ...form, gender: val })}>
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {GENDER_OPTIONS.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {lang === 'uz' ? opt.label_uz : opt.label_ru}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-border mt-4">
                                        <Label className="text-muted-foreground block mb-2 font-medium">{lang === 'ru' ? 'О себе' : 'O\'zingiz haqingizda'} <span className="text-red-500">*</span></Label>
                                        <Textarea
                                            rows={5}
                                            placeholder={lang === 'ru' ? 'Коротко о ваших сильных сторонах...' : 'Kuchli tomonlaringiz, yutuqlaringiz va maqsadlaringiz haqida...'}
                                            aria-label={lang === 'ru' ? 'О себе' : 'O‘zim haqimda'} value={form.about}
                                            onChange={(e) => setForm({ ...form, about: e.target.value })}
                                            className="resize-y leading-relaxed"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Experience Section */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Briefcase className="w-5 h-5 text-primary" />
                                        {lang === 'ru' ? 'Опыт работы' : 'Ish tajribasi'}
                                    </CardTitle>
                                    <Button type="button" variant="ghost" size="sm" onClick={addExperience} className="text-primary">
                                        <Plus className="w-4 h-4 mr-1" />
                                        {lang === 'ru' ? 'Добавить' : 'Qo\'shish'}
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <label className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{lang === 'ru' ? 'Общий стаж' : 'Umumiy tajriba'}
                                        <select className="rounded-lg border border-border bg-card px-3 py-2" value={form.experience_level} onChange={event => setForm(previous => ({ ...previous, experience_level: event.target.value }))}>
                                            {['no_experience', '1_year', '3_years', '5_years', '10_years'].map((value, index) => <option key={value} value={value}>{index === 0 ? (lang === 'ru' ? 'Без опыта' : 'Tajribasiz') : `${[0, 1, 3, 5, 10][index]} ${lang === 'ru' ? (index === 1 ? 'год' : 'лет') : 'yil'}`}</option>)}
                                        </select>
                                    </label>
                                    {experiences.map((exp, idx) => (
                                        <div key={exp.id} className="p-5 rounded-xl border border-border bg-background space-y-4 relative transition-all hover:border-border hover:shadow-sm">
                                            <Button type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                                onClick={() => removeExperience(exp.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground font-semibold uppercase">{lang === 'ru' ? 'Место работы' : 'Ish joyi'}</Label>
                                                    <Input
                                                        value={exp.company}
                                                        onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                                                        className="bg-card"
                                                        placeholder={lang === 'ru' ? 'Название компании' : 'Kompaniya nomi'}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground font-semibold uppercase">{lang === 'ru' ? 'Должность' : 'Lavozim'}</Label>
                                                    <Input
                                                        value={exp.position}
                                                        onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                                                        className="bg-card"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground font-semibold uppercase">{lang === 'ru' ? 'Год начала' : 'Boshlagan yili'}</Label>
                                                    <Select
                                                        value={exp.start_date || ''}
                                                        onValueChange={(val) => updateExperience(exp.id, 'start_date', val)}
                                                    >
                                                        <SelectTrigger className="bg-card">
                                                            <SelectValue placeholder={lang === 'ru' ? 'Год' : 'Yil'} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground font-semibold uppercase">{lang === 'ru' ? 'Год окончания' : 'Tugatgan yili'}</Label>
                                                    <Select
                                                        value={exp.end_date || ''}
                                                        onValueChange={(val) => updateExperience(exp.id, 'end_date', val)}
                                                    >
                                                        <SelectTrigger className="bg-card">
                                                            <SelectValue placeholder={lang === 'ru' ? 'Год' : 'Yil'} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="current">{lang === 'ru' ? 'По настоящее' : 'Hozirgi'}</SelectItem>
                                                            {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-muted-foreground font-semibold uppercase">{lang === 'ru' ? 'Обязанности' : 'Vazifalar'}</Label>
                                                <Textarea
                                                    value={exp.description}
                                                    onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                                                    rows={3}
                                                    className="resize-y bg-card"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {experiences.length === 0 && (
                                        <div className="text-center py-6 bg-background/50 rounded-xl border border-dashed border-border">
                                            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-muted-foreground text-sm">
                                                {lang === 'ru' ? 'Добавьте опыт работы' : 'Ish tajribasi kiritilmagan'}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Education Section (Renamed & Integrated) */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <GraduationCap className="w-5 h-5 text-primary" />
                                            {lang === 'ru' ? 'Ваше образование' : 'Ma\'lumotingiz'}
                                        </CardTitle>
                                    </div>
                                    {form.education_level !== 'secondary' && (
                                        <Button type="button" variant="ghost" size="sm" onClick={addEducation} className="text-primary">
                                            <Plus className="w-4 h-4 mr-1" />
                                            {lang === 'ru' ? 'Добавить' : 'Qo\'shish'}
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-6">

                                    {/* Level Select Inside Card */}
                                    <div className="p-4 bg-background rounded-lg border border-border">
                                        <Label className="mb-2 block text-sm font-medium text-foreground">{lang === 'ru' ? 'Уровень образования' : 'Ma\'lumot darajasi'}</Label>
                                        <Select
                                            value={form.education_level}
                                            onValueChange={(val) => { setForm({ ...form, education_level: val }); if (val !== 'secondary' && !educations.length) addEducation(); }}
                                        >
                                            <SelectTrigger className="bg-card">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {EDUCATION_OPTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {lang === 'uz' ? opt.label_uz : opt.label_ru}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {form.education_level !== 'secondary' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            {educations.map((edu, idx) => (
                                                <div key={edu.id} className="p-5 rounded-xl border border-border bg-background/50 space-y-4 relative">
                                                    <Button type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                                        onClick={() => removeEducation(edu.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    <div className="space-y-2">
                                                        <Input
                                                            placeholder={lang === 'ru' ? 'Учебное заведение' : 'O\'quv yurti'}
                                                            value={edu.institution}
                                                            onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                                                            className="bg-card font-medium"
                                                        />
                                                        <Input
                                                            placeholder={lang === 'ru' ? 'Факультет / Специальность' : 'Fakultet / Yo\'nalish'}
                                                            value={edu.field}
                                                            onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                                                            className="bg-card text-sm"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">{lang === 'ru' ? 'Год начала' : 'Boshlagan yili'}</Label>
                                                            <Select
                                                                value={edu.start_year || ''}
                                                                onValueChange={(val) => updateEducation(edu.id, 'start_year', val)}
                                                            >
                                                                <SelectTrigger className="bg-card">
                                                                    <SelectValue placeholder={lang === 'ru' ? 'Год' : 'Yil'} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">{lang === 'ru' ? 'Год окончания' : 'Tugatgan yili'}</Label>
                                                            <Select
                                                                value={edu.end_year || ''}
                                                                onValueChange={(val) => updateEducation(edu.id, 'end_year', val)}
                                                            >
                                                                <SelectTrigger className="bg-card">
                                                                    <SelectValue placeholder={lang === 'ru' ? 'Год' : 'Yil'} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="current">{lang === 'ru' ? 'По настоящее' : 'Hozirgi'}</SelectItem>
                                                                    {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {educations.length === 0 && (
                                                <div className="text-center py-6 border border-dashed border-border rounded-lg">
                                                    <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                                    <p className="text-muted-foreground text-sm">{lang === 'ru' ? 'Укажите историю обучения' : 'O\'qish tarixini kiriting'}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">
                                            <CheckCircle2 className="w-5 h-5" />
                                            {lang === 'ru' ? 'Для среднего образования история не требуется' : 'O\'rta ma\'lumot uchun qo\'shimcha maydonlar shart emas'}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                        {/* Right Column: Sidebar (1 col) */}
                        <div className="lg:col-span-1 space-y-6">

                            {/* Save Buttons */}
                            <div className="grid grid-cols-1 gap-3 sticky top-4 z-10">
                                <Button type="button"
                                    onClick={() => handleSubmit(false)}
                                    disabled={saving}
                                    className="w-full bg-primary hover:bg-primary text-white gap-2 h-12 text-base shadow-md transition-all hover:scale-[1.02]"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    {lang === 'ru' ? 'Разместить' : 'Joylash'}
                                </Button>
                                <Button type="button"
                                    variant="outline"
                                    onClick={() => handleSubmit(true)}
                                    disabled={saving}
                                    className="w-full"
                                >
                                    {lang === 'ru' ? 'Черновик' : 'Qoralama'}
                                </Button>
                            </div>

                            {/* Skills Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Tag className="w-5 h-5 text-primary" />
                                        {lang === 'ru' ? 'Навыки' : 'Ko\'nikmalar'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={lang === 'ru' ? 'Навык...' : 'Ko\'nikma...'}
                                            value={newSkill}
                                            onChange={(e) => setNewSkill(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                                        />
                                        <Button type="button" onClick={addSkill} size="icon" variant="secondary">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map(skill => (
                                            <Badge key={skill} variant="secondary" className="px-3 py-1 bg-card border cursor-default flex items-center gap-2">
                                                {skill}
                                                <button onClick={() => removeSkill(skill)} className="hover:text-red-500 transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Languages Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Languages className="w-5 h-5 text-primary" />
                                        {lang === 'ru' ? 'Языки' : 'Tillar'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {languages.map(langItem => (
                                        <div key={langItem.id} className="flex flex-col gap-2 p-3 bg-background rounded-lg relative group border border-border">
                                            <Button type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6 text-red-500 opacity-50 hover:opacity-100"
                                                onClick={() => removeLanguage(langItem.id)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>

                                            <div className="w-full">
                                                <Select
                                                    value={langItem.name}
                                                    onValueChange={(val) => updateLanguage(langItem.id, 'name', val)}
                                                >
                                                    <SelectTrigger className="h-9 bg-card">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {LANGUAGES_LIST.map(l => (
                                                            <SelectItem key={l.value} value={l.value}>
                                                                {lang === 'uz' ? l.label_uz : l.label_ru}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="w-full">
                                                <Select
                                                    value={langItem.level}
                                                    onValueChange={(value) => updateLanguage(langItem.id, 'level', value)}
                                                >
                                                    <SelectTrigger className="h-9 bg-card">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unspecified">{lang === 'ru' ? 'Уровень не указан' : 'Daraja ko‘rsatilmagan'}</SelectItem>
                                                        <SelectItem value="beginner">{lang === 'ru' ? 'Начальный' : 'Boshlang\'ich'}</SelectItem>
                                                        <SelectItem value="intermediate">{lang === 'ru' ? 'Средний' : 'O\'rta'}</SelectItem>
                                                        <SelectItem value="advanced">{lang === 'ru' ? 'Продвинутый' : 'Yuqori'}</SelectItem>
                                                        <SelectItem value="native">{lang === 'ru' ? 'Родной' : 'Ona tili'}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addLanguage} className="w-full text-primary border-border border-dashed hover:bg-accent">
                                        <Plus className="w-4 h-4 mr-2" />
                                        {lang === 'ru' ? 'Добавить язык' : 'Til qo\'shish'}
                                    </Button>
                                </CardContent>
                            </Card>

                        </div>
                    </div>
                </form>
            </div>
        </ProfileLayout>
    );
}
