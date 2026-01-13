'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { LANGUAGES_LIST, EDUCATION_OPTIONS, GENDER_OPTIONS } from '@/lib/constants';
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

export default function EditResumePage() {
    const { lang } = useLanguage();
    const router = useRouter();
    const params = useParams();
    const resumeId = params.id as string;
    const { user } = useUserAuth();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        const loadData = async () => {
            if (!user?.id || !resumeId) return;

            try {
                const [catsRes, resumeRes] = await Promise.all([
                    supabase.from('categories').select('*').order('name_uz'),
                    supabase.from('resumes').select('*').eq('id', resumeId).single()
                ]);
                // supabase.from('districts').select('*').order('name_uz'), // removed

                if (catsRes.data) setCategories(catsRes.data);
                // if (distsRes.data) setDistricts(distsRes.data);

                const data = resumeRes.data;
                if (!data) {
                    toast.error("Resume not found");
                    router.push('/profile/job-seeker/resumes');
                    return;
                }

                setForm({
                    title: data.title || '',
                    full_name: data.full_name || '',
                    birth_date: data.birth_date || '',
                    phone: data.phone || '',
                    district_id: data.district_id || '',
                    category_id: data.category_id || '',
                    experience_level: data.experience || 'no_experience',
                    education_level: data.education_level || 'secondary',
                    gender: data.gender || 'male',
                    salary_min: data.expected_salary_min?.toString() || '',
                    salary_max: data.expected_salary_max?.toString() || '',
                    about: data.about || '',
                    is_visible: data.is_public ?? true,
                    status: data.status || 'active',
                    employment_type: data.employment_type || 'full_time',
                });

                // Improved Region/District Loading
                if (data.district_id) {
                    const dist = await getDistrictById(data.district_id);
                    if (dist && dist.region_id) {
                        setSelectedRegion(String(dist.region_id));
                        setForm(prev => ({ ...prev, region_id: String(dist.region_id) }));
                        console.log('Loaded region from district:', dist.region_id);
                    }
                } else if (data.city && /^\d+$/.test(data.city)) {
                    // Backward compatibility for when city stored district_id
                    const dist = await getDistrictById(data.city);
                    if (dist && dist.region_id) {
                        setSelectedRegion(String(dist.region_id));
                        setForm(prev => ({
                            ...prev,
                            district_id: data.city || '',
                            region_id: String(dist.region_id)
                        }));
                    }
                } else if (data.region_id) {
                    setSelectedRegion(String(data.region_id));
                    setForm(prev => ({ ...prev, region_id: String(data.region_id) }));
                }

                if (data.skills && Array.isArray(data.skills)) setSkills(data.skills);
                if (data.experience_details && Array.isArray(data.experience_details)) setExperiences(data.experience_details);
                if (data.education && Array.isArray(data.education)) setEducations(data.education);
                if (data.languages && Array.isArray(data.languages)) setLanguages(data.languages);

            } catch (err) {
                console.error('Error loading data:', err);
                toast.error("Error loading resume");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user?.id, resumeId]);

    // Auto-add education field when level changes from secondary
    useEffect(() => {
        if (form.education_level !== 'secondary' && educations.length === 0 && !loading) {
            addEducation();
        }
    }, [form.education_level, loading]);


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
        setExperiences(prev => [...prev, {
            id: Date.now().toString(),
            company: '', // Label 'Ish joyi'
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
            id: Date.now().toString(),
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
            id: Date.now().toString(),
            name: 'uzbek', // default
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

            if (data.success && data.result) {
                const resData = data.result;
                setForm(prev => ({
                    ...prev,
                    title: resData.title || prev.title,
                    full_name: resData.full_name || prev.full_name,
                    about: resData.about || prev.about,
                    phone: resData.phone || prev.phone,
                    birth_date: resData.birth_date || prev.birth_date,
                    gender: resData.gender || prev.gender,
                    salary_min: resData.salary_min || prev.salary_min,
                    salary_max: resData.salary_max || prev.salary_max,
                    category_id: resData.category_id || prev.category_id,
                    district_id: resData.district_id || prev.district_id,
                    experience_level: resData.experience_level || prev.experience_level,
                    education_level: resData.education_level || prev.education_level,
                }));

                if (resData.district_id && !form.district_id) {
                    const dist = await getDistrictById(resData.district_id);
                    if (dist && dist.region_id) setSelectedRegion(dist.region_id.toString());
                }
                if (resData.skills && Array.isArray(resData.skills)) {
                    setSkills(prev => Array.from(new Set([...prev, ...resData.skills])));
                }
                // Process Languages from AI
                if (resData.languages && Array.isArray(resData.languages)) {
                    const newLangs = resData.languages.map((l: string, i: number) => ({
                        id: `ai-${Date.now()}-${i}`,
                        name: l.toLowerCase(),
                        level: 'intermediate'
                    }));
                    setLanguages(prev => [...prev, ...newLangs]);
                }

                // Add placeholder experience if years > 0 AND no details
                if (resData.experience_years_count > 0 && (!resData.experience_details || resData.experience_details.length === 0)) {
                    if (experiences.length === 0) {
                        setExperiences([{
                            id: Date.now().toString(),
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
            toast.error('Network Error');
        } finally {
            setAiGenerating(false);
        }
    };


    const handleSubmit = async (isDraft: boolean = false) => {
        if (!user?.id || !resumeId) return;
        setSaving(true);

        if (!form.title.trim() && !isDraft) {
            toast.error(lang === 'ru' ? 'Введите название резюме' : 'Rezyume nomini kiriting');
            setSaving(false);
            return;
        }

        try {
            // Fetch district info for city name
            let cityName = form.district_id;
            if (form.district_id) {
                const dist = await getDistrictById(parseInt(form.district_id));
                if (dist) {
                    cityName = lang === 'uz' ? dist.name_uz : dist.name_ru;
                }
            }

            // Validate integer conversion
            const salMin = form.salary_min ? parseInt(form.salary_min) : null;
            const salMax = form.salary_max ? parseInt(form.salary_max) : null;
            if (form.salary_min && isNaN(salMin!)) throw new Error("Invalid salary min");
            if (form.salary_max && isNaN(salMax!)) throw new Error("Invalid salary max");

            // Ensure null for empty IDs
            const distId = form.district_id && form.district_id.trim() !== '' ? form.district_id : null;
            const catId = form.category_id && form.category_id.trim() !== '' ? form.category_id : null;
            const birthDate = form.birth_date && form.birth_date.trim() !== '' ? form.birth_date : null;

            // Sanitize complex arrays
            const sanitizedExperience = experiences.map(({ id, ...rest }) => rest);
            const sanitizedEducation = educations.map(({ id, start_year, end_year, ...rest }) => ({
                ...rest,
                start_year: parseInt(start_year) || 0,
                end_year: end_year ? parseInt(end_year) : null
            }));
            const sanitizedLanguages = languages.map(({ id, ...rest }) => rest);

            const { error } = await supabase
                .from('resumes')
                .update({
                    title: form.title,
                    full_name: form.full_name,
                    birth_date: birthDate,
                    phone: form.phone,
                    city: cityName || '',
                    region_id: form.region_id ? parseInt(form.region_id) : null,
                    district_id: distId,
                    category_id: catId,
                    employment_type: form.employment_type,
                    experience: form.experience_level,
                    education_level: form.education_level,
                    gender: form.gender,
                    experience_years: form.experience_level === 'no_experience' ? 0
                        : form.experience_level === '1_year' ? 1
                            : form.experience_level === '3_years' ? 3
                                : form.experience_level === '5_years' ? 5
                                    : form.experience_level === '10_years' ? 10
                                        : experiences.length > 0 ? experiences.length : 0,

                    about: form.about,
                    skills: skills,
                    experience_details: sanitizedExperience,
                    education: sanitizedEducation,
                    languages: sanitizedLanguages,

                    expected_salary_min: salMin,
                    expected_salary_max: salMax,

                    is_public: form.is_visible,
                    status: isDraft ? 'draft' : 'active',
                })
                .eq('id', resumeId);

            if (error) throw error;

            toast.success(lang === 'ru' ? 'Резюме обновлено' : 'Rezyume yangilandi');
            router.push('/profile/job-seeker/resumes');

        } catch (err: any) {
            console.error('Error saving:', err);
            toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Saqlashda xatolik');
        } finally {
            setSaving(false);
        }
    };


    if (loading) {
        return (
            <ProfileLayout userType="job_seeker" userName="Foydalanuvchi">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
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
                                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                                    <Wand2 className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">{lang === 'ru' ? 'AI Помощник' : 'AI Yordamchi'}</CardTitle>
                                    <CardDescription className="text-base">{lang === 'ru' ? 'Опишите ваш опыт, и AI заполнит резюме' : 'Tajribangizni tasvirlab bering, AI rezyumeni to\'ldiradi'}</CardDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowAIModal(false)}>
                                <X className="w-6 h-6" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <Textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder={lang === 'ru' ? 'Я работал бухгалтером 3 года, знаю 1С, Excel...' : 'Masalan: Men 3 yil hisobchi bo\'lib ishlaganman, 1C, Excel dasturlarini bilaman...'}
                                rows={8}
                                className="text-base p-4 border-slate-200 focus:border-violet-500 transition-colors"
                            />
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm text-slate-400">
                                    {MAX_AI_USES - aiUsageCount} {lang === 'ru' ? 'попыток осталось' : 'ta imkoniyat qoldi'}
                                </span>
                                <Button
                                    onClick={handleAIGenerate}
                                    disabled={aiGenerating || !aiPrompt.trim()}
                                    className="bg-violet-600 hover:bg-violet-700 px-8 h-11 text-base shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02]"
                                >
                                    {aiGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Wand2 className="w-5 h-5 mr-2" />}
                                    {lang === 'ru' ? 'Заполнить' : 'To\'ldirish'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8 pb-20">

                {/* Header with Title and AI Button Centered */}
                <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 h-auto md:h-14">
                    {/* Left: Back and Title */}
                    <div className="flex items-center gap-4 w-full md:w-auto md:absolute md:left-0">
                        <Link href="/profile/job-seeker/resumes">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                {lang === 'ru' ? 'Редактировать резюме' : 'Rezyume tahrirlash'}
                            </h1>
                        </div>
                    </div>

                    {/* Center: AI Button */}
                    <div className="w-full md:w-auto flex justify-center">
                        <Button
                            type="button"
                            onClick={() => setShowAIModal(true)}
                            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 gap-3 px-8 h-12 text-base shadow-lg shadow-violet-500/20 text-white transition-all hover:scale-[1.02]"
                        >
                            <Wand2 className="w-5 h-5" />
                            <div className="flex flex-col items-center leading-tight">
                                <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">AI Yordamchi</span>
                                <span className="text-[10px] opacity-90 font-light">Sun&apos;iy intellekt yordamida to&apos;ldirish</span>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Main Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column: Main Content (2 cols wide) */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Target & Salary Card (New Top Section) */}
                            <Card className="border-violet-100 shadow-sm">
                                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                                    <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                                        <Briefcase className="w-5 h-5 text-violet-600" />
                                        {lang === 'ru' ? 'Желаемая должность и Зарплата' : 'Istalgan lavozim va Maosh'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold text-base">{lang === 'ru' ? 'Желаемая должность' : 'Istalgan lavozim'} <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder={lang === 'ru' ? 'Например: Бухгалтер' : 'Masalan: Hisobchi'}
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            className="h-12 text-lg border-slate-300 focus:border-violet-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-slate-700 font-medium">{lang === 'ru' ? 'Ожидаемая зарплата (UZS)' : 'Kutilayotgan maosh (UZS)'}</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full">
                                                    <Input
                                                        placeholder="Min"
                                                        value={form.salary_min}
                                                        onChange={(e) => handleSalaryChange(e.target.value, 'min')}
                                                        className="h-11 pl-3 font-medium"
                                                    />
                                                    <span className="absolute right-3 top-3 text-xs text-slate-400">
                                                        {formatCurrency(form.salary_min)}
                                                    </span>
                                                </div>
                                                <span className="text-slate-400">-</span>
                                                <div className="relative w-full">
                                                    <Input
                                                        placeholder="Max"
                                                        value={form.salary_max}
                                                        onChange={(e) => handleSalaryChange(e.target.value, 'max')}
                                                        className="h-11 pl-3 font-medium"
                                                    />
                                                    <span className="absolute right-3 top-3 text-xs text-slate-400">
                                                        {formatCurrency(form.salary_max)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-700 font-medium">{lang === 'ru' ? 'Категория' : 'Kategoriya'}</Label>
                                            <Select value={form.category_id} onValueChange={(val) => setForm({ ...form, category_id: val })}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder={lang === 'ru' ? 'Выберите категорию' : 'Kategoriyani tanlang'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(cat => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {lang === 'uz' ? cat.name_uz : cat.name_ru}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Basic Info & About */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <User className="w-5 h-5 text-violet-500" />
                                        {lang === 'ru' ? 'Личные данные' : 'Shaxsiy ma\'lumotlar'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">{lang === 'ru' ? 'ФИО' : 'To\'liq ismingiz'} *</Label>
                                            <Input
                                                value={form.full_name}
                                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                                placeholder="Ism Familiya"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">{lang === 'ru' ? 'Телефон' : 'Telefon raqam'} *</Label>
                                            <Input
                                                value={form.phone}
                                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                                placeholder="+998 90 123 45 67"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="col-span-1 md:col-span-3">
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
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">{lang === 'ru' ? 'Дата рождения' : 'Tug\'ilgan sana'}</Label>
                                            <Input
                                                type="date"
                                                value={form.birth_date}
                                                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">{lang === 'ru' ? 'Пол' : 'Jinsi'}</Label>
                                            <Select value={form.gender} onValueChange={(val) => setForm({ ...form, gender: val })}>
                                                <SelectTrigger>
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

                                    <div className="space-y-2 pt-2 border-t border-slate-100 mt-4">
                                        <Label className="text-slate-600 block mb-2 font-medium">{lang === 'ru' ? 'О себе' : 'O\'zingiz haqingizda'}</Label>
                                        <Textarea
                                            rows={5}
                                            placeholder={lang === 'ru' ? 'Коротко о ваших сильных сторонах...' : 'Kuchli tomonlaringiz, yutuqlaringiz va maqsadlaringiz haqida...'}
                                            value={form.about}
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
                                        <Briefcase className="w-5 h-5 text-violet-500" />
                                        {lang === 'ru' ? 'Опыт работы' : 'Ish tajribasi'}
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" onClick={addExperience} className="text-violet-600">
                                        <Plus className="w-4 h-4 mr-1" />
                                        {lang === 'ru' ? 'Добавить' : 'Qo\'shish'}
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {experiences.map((exp, idx) => (
                                        <div key={exp.id} className="p-5 rounded-xl border border-slate-100 bg-slate-50 space-y-4 relative transition-all hover:border-violet-100 hover:shadow-sm">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                                onClick={() => removeExperience(exp.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-slate-500 font-semibold uppercase">{lang === 'ru' ? 'Место работы' : 'Ish joyi'}</Label>
                                                    <Input
                                                        value={exp.company}
                                                        onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                                                        className="bg-white"
                                                        placeholder={lang === 'ru' ? 'Название компании' : 'Kompaniya nomi'}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-slate-500 font-semibold uppercase">{lang === 'ru' ? 'Должность' : 'Lavozim'}</Label>
                                                    <Input
                                                        value={exp.position}
                                                        onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                                                        className="bg-white"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-slate-500 font-semibold uppercase">{lang === 'ru' ? 'Начало (Год)' : 'Boshlangan yili'}</Label>
                                                    <Input type="number" value={exp.start_date} onChange={(e) => updateExperience(exp.id, 'start_date', e.target.value)} placeholder="2020" className="bg-white text-sm" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-slate-500 font-semibold uppercase">{lang === 'ru' ? 'Окончание (Год)' : 'Tugagan yili'}</Label>
                                                    <Input type="number" value={exp.end_date} onChange={(e) => updateExperience(exp.id, 'end_date', e.target.value)} disabled={exp.is_current} placeholder={lang === 'ru' ? '2023 или пусто' : '2023 yoki bo\'sh'} className="bg-white text-sm" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-500 font-semibold uppercase">{lang === 'ru' ? 'Обязанности' : 'Vazifalar'}</Label>
                                                <Textarea
                                                    value={exp.description}
                                                    onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                                                    rows={3}
                                                    className="resize-y bg-white"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {experiences.length === 0 && (
                                        <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm">
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
                                            <GraduationCap className="w-5 h-5 text-violet-500" />
                                            {lang === 'ru' ? 'Ваше образование' : 'Ma\'lumotingiz'}
                                        </CardTitle>
                                    </div>
                                    {form.education_level !== 'secondary' && (
                                        <Button variant="ghost" size="sm" onClick={addEducation} className="text-violet-600">
                                            <Plus className="w-4 h-4 mr-1" />
                                            {lang === 'ru' ? 'Добавить' : 'Qo\'shish'}
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-6">

                                    {/* Level Select Inside Card */}
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <Label className="mb-2 block text-sm font-medium text-slate-700">{lang === 'ru' ? 'Уровень образования' : 'Ma\'lumot darajasi'}</Label>
                                        <Select
                                            value={form.education_level}
                                            onValueChange={(val) => setForm({ ...form, education_level: val })}
                                        >
                                            <SelectTrigger className="bg-white">
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
                                                <div key={edu.id} className="p-5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4 relative">
                                                    <Button
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
                                                            className="bg-white font-medium"
                                                        />
                                                        <Input
                                                            placeholder={lang === 'ru' ? 'Факультет / Специальность' : 'Fakultet / Yo\'nalish'}
                                                            value={edu.field}
                                                            onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                                                            className="bg-white text-sm"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Начало' : 'Kirgan yili'}</Label>
                                                            <Input type="number" value={edu.start_year} onChange={(e) => updateEducation(edu.id, 'start_year', e.target.value)} placeholder="2018" className="bg-white" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Окончание' : 'Bitirgan yili'}</Label>
                                                            <Input type="number" value={edu.end_year} onChange={(e) => updateEducation(edu.id, 'end_year', e.target.value)} placeholder="2022" className="bg-white" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {educations.length === 0 && (
                                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
                                                    <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                    <p className="text-slate-500 text-sm">{lang === 'ru' ? 'Укажите историю обучения' : 'O\'qish tarixini kiriting'}</p>
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
                                <Button
                                    onClick={() => handleSubmit(false)}
                                    disabled={saving}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2 h-12 text-base shadow-md transition-all hover:scale-[1.02]"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    {lang === 'ru' ? 'Сохранить изменения' : 'Saqlash'}
                                </Button>
                                {/* Draft removed in edit usually, but keeping logic if needed */}
                            </div>

                            {/* Skills Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Tag className="w-5 h-5 text-violet-500" />
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
                                        <Button onClick={addSkill} size="icon" variant="secondary">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map(skill => (
                                            <Badge key={skill} variant="secondary" className="px-3 py-1 bg-white border cursor-default flex items-center gap-2">
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
                                        <Languages className="w-5 h-5 text-violet-500" />
                                        {lang === 'ru' ? 'Языки' : 'Tillar'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {languages.map(langItem => (
                                        <div key={langItem.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg relative group border border-slate-100">
                                            <Button
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
                                                    <SelectTrigger className="h-9 bg-white">
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
                                                    <SelectTrigger className="h-9 bg-white">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="beginner">{lang === 'ru' ? 'Начальный' : 'Boshlang\'ich'}</SelectItem>
                                                        <SelectItem value="intermediate">{lang === 'ru' ? 'Средний' : 'O\'rta'}</SelectItem>
                                                        <SelectItem value="advanced">{lang === 'ru' ? 'Продвинутый' : 'Yuqori'}</SelectItem>
                                                        <SelectItem value="native">{lang === 'ru' ? 'Родной' : 'Ona tili'}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={addLanguage} className="w-full text-violet-600 border-violet-200 border-dashed hover:bg-violet-50">
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
