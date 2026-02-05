'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, User, Briefcase, GraduationCap, Languages as LanguagesIcon,
    MapPin, Phone, Calendar, Loader2, Mail, CheckCircle, Banknote
} from '@/components/ui/icons';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatSalary, formatDate, EXPERIENCE_OPTIONS, EDUCATION_OPTIONS, LANGUAGES_LIST, GENDER_OPTIONS } from '@/lib/constants';

interface Resume {
    id: string;
    user_id: string;
    title: string;
    full_name: string | null;
    birth_date: string | null;
    phone: string;
    city: string | null;
    about: string | null;
    skills: any;
    experience: any;
    experience_details: any;
    experience_years: number;
    education_level: string | null;
    education: any;
    languages: any;
    expected_salary_min: number | null;
    expected_salary_max: number | null;
    gender: string | null;
    employment_type: string | null;
    created_at: string;
    district_id: string | null;
    is_public: boolean;
    status: string;
}

export default function ResumeDetailPage() {
    const { lang } = useLanguage();
    const { user: currentUser, isAuthenticated } = useUserAuth();
    const params = useParams();
    const router = useRouter();
    const { openModal } = useAuthModal();
    const resumeId = params.id as string;

    const [resume, setResume] = useState<Resume | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [districtName, setDistrictName] = useState<string>('');

    const toArray = (value: any): any[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && typeof parsed === 'object') return [parsed];
                } catch {
                    // fall through to comma split
                }
            }
            return trimmed.split(',').map(item => item.trim()).filter(Boolean);
        }
        if (typeof value === 'object') return [value];
        return [];
    };

    const normalizeSkills = (value: any): string[] => {
        return toArray(value)
            .map(item => {
                if (typeof item === 'string') return item;
                if (item?.name) return item.name;
                if (item?.title) return item.title;
                return '';
            })
            .map(item => String(item).trim())
            .filter(Boolean);
    };

    const normalizeLanguages = (value: any): Array<{ name: string; level?: string }> => {
        return toArray(value)
            .map(item => {
                if (typeof item === 'string') return { name: item };
                if (item?.language) return { name: item.language, level: item.level || item.grade };
                if (item?.name) return { name: item.name, level: item.level || item.grade };
                return null;
            })
            .filter(Boolean) as Array<{ name: string; level?: string }>;
    };

    const normalizeExperience = (resumeValue: Resume | null): any[] => {
        if (!resumeValue) return [];
        const primary = toArray(resumeValue.experience_details);
        if (primary.length > 0) return primary;
        if (resumeValue.experience && (Array.isArray(resumeValue.experience) || typeof resumeValue.experience === 'object')) {
            return toArray(resumeValue.experience);
        }
        return [];
    };

    const normalizeEducation = (resumeValue: Resume | null): any[] => {
        if (!resumeValue) return [];
        const primary = toArray(resumeValue.education);
        if (primary.length > 0) return primary;
        return [];
    };

    useEffect(() => {
        const fetchResume = async () => {
            if (!resumeId) return;

            try {
                const { data, error } = await supabase
                    .from('resumes')
                    .select('*')
                    .eq('id', resumeId)
                    .single();

                if (error || !data) {
                    console.error('Resume fetch error:', error);
                    setNotFound(true);
                } else {
                    setResume(data);

                    // Fetch telegram from profile
                    const { data: profile } = await supabase
                        .from('job_seeker_profiles')
                        .select('telegram')
                        .eq('user_id', data.user_id)
                        .single();

                    if (profile?.telegram) {
                        // We'll attach it to resume object dynamically or use separate state
                        // Let's use separate state for now to avoid Type issues or extend the type locally
                        // Actually, let's just extend the type locally or cast
                        (data as any).telegram = profile.telegram;
                        setResume({ ...data, telegram: profile.telegram });
                    }

                    // Fetch district and region name if district_id exists
                    if (data.district_id) {
                        const { data: distData } = await supabase
                            .from('districts')
                            .select('name_uz, name_ru, regions(name_uz, name_ru)')
                            .eq('id', data.district_id)
                            .single();
                        if (distData) {
                            const dName = lang === 'uz' ? distData.name_uz : distData.name_ru;
                            const rName = lang === 'uz' ? (distData as any).regions?.name_uz : (distData as any).regions?.name_ru;
                            const rLabel = rName ? (lang === 'uz' ? `${rName} vil.` : `${rName} обл.`) : '';
                            setDistrictName(rLabel ? `${rLabel}, ${dName}` : dName);
                        }
                    } else if (data.city) {
                        setDistrictName(data.city);
                    }
                }
            } catch (err) {
                console.error('Error fetching resume:', err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        fetchResume();
    }, [resumeId, lang]);

    const getExperienceLabel = (value: string) => {
        const opt = EXPERIENCE_OPTIONS.find(o => o.value === value);
        return opt ? (lang === 'uz' ? opt.label_uz : opt.label_ru) : (lang === 'ru' ? 'Не указано' : 'Ko\'rsatilmagan');
    };

    const getEducationLabel = (value: string) => {
        const opt = EDUCATION_OPTIONS.find(o => o.value === value);
        return opt ? (lang === 'uz' ? opt.label_uz : opt.label_ru) : (lang === 'ru' ? 'Не указано' : 'Ko\'rsatilmagan');
    };

    const getGenderLabel = (value: string) => {
        const opt = GENDER_OPTIONS.find(o => o.value === value);
        return opt ? (lang === 'uz' ? opt.label_uz : opt.label_ru) : (lang === 'ru' ? 'Не указано' : 'Ko\'rsatilmagan');
    };

    const getLanguageLabel = (value: string) => {
        if (!value) return '';
        const opt = LANGUAGES_LIST.find(o => o.value === value.toLowerCase());
        return opt ? (lang === 'uz' ? opt.label_uz : opt.label_ru) : value;
    };

    const calculateAge = (birthDate: string) => {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const handleContact = async () => {
        if (!resume) return;

        if (!isAuthenticated || !currentUser) {
            // Not logged in - show auth modal
            openModal();
            return;
        }

        // User is logged in - check if employer
        const { data: employer } = await supabase
            .from('employer_profiles')
            .select('id')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (employer) {
            // Is employer - redirect to chat
            router.push(`/profile/employer/messages?chat_with=${resume.user_id}`);
        } else {
            // Not an employer - show error message
            toast.error(lang === 'uz' ? 'Faqat ish beruvchilar yozishi mumkin' : 'Только работодатели могут писать');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (notFound || !resume) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <h1 className="text-2xl font-bold text-slate-900">
                    {lang === 'uz' ? 'Rezyume topilmadi' : 'Резюме не найдено'}
                </h1>
                <p className="text-slate-500">
                    {lang === 'uz' ? 'Bu rezyume mavjud emas yoki yashirilgan' : 'Это резюме не существует или скрыто'}
                </p>
                <Button onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {lang === 'uz' ? 'Orqaga' : 'Назад'}
                </Button>
            </div>
        );
    }

    const skillsList = normalizeSkills(resume.skills);
    const languageList = normalizeLanguages(resume.languages);
    const experienceList = normalizeExperience(resume);
    const educationList = normalizeEducation(resume);

    return (
        <div className="min-h-screen bg-white">
            {/* Profile Hero Section - Solid Indigo Gradient (Matches Job Page) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 py-6 md:py-8 text-white">
                {/* Background Patterns */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-400 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                </div>

                <div className="container relative mx-auto px-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="text-white/70 hover:text-white hover:bg-white/10 mb-6 -ml-2 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        {lang === 'uz' ? 'Orqaga' : 'Назад'}
                    </Button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                        <div className="flex flex-col md:flex-row gap-6 md:items-center">
                            {/* Profile Avatar Placeholder - Solid White/Indigo */}
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-3xl md:text-4xl font-bold text-white shadow-xl">
                                {(resume.full_name || resume.title || 'I').charAt(0)}
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="bg-white/10 text-white hover:bg-white/20 border-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold capitalize">
                                        {getEducationLabel(resume.education_level || '')}
                                    </Badge>
                                    <Badge className="bg-indigo-500/20 text-indigo-100 border-indigo-500/30 backdrop-blur-sm px-3 py-1 text-xs font-bold capitalize">
                                        {getExperienceLabel(resume.experience)}
                                    </Badge>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                                    {resume.title || (lang === 'ru' ? 'Специалист' : 'Mutaxassis')}
                                </h1>
                                <div className="flex flex-wrap items-center gap-5 text-indigo-100/90 text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-indigo-300" />
                                        <span>{resume.full_name || (lang === 'ru' ? 'Имя не указано' : 'Ism ko'rsatilmagan')}</span>
                                    </div>
                                    {districtName && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-indigo-300" />
                                            <span>{districtName}</span>
                                        </div>
                                    )}
                                    {resume.birth_date && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-indigo-300" />
                                            <span>{calculateAge(resume.birth_date)} {lang === 'ru' ? 'лет' : 'yosh'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-auto">
                            <Button
                                onClick={handleContact}
                                className="w-full md:w-auto h-12 px-8 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold shadow-xl shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Mail className="w-5 h-5" />
                                {lang === 'ru' ? 'Написать сообщение' : 'Xabar yozish'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 md:py-8">
                <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
                    {/* MAIN CONTENT */}
                    <div className="lg:col-span-2 space-y-6 md:space-y-8">
                        {/* About Section */}
                        {resume.about && (
                            <Card className="border-slate-200 shadow-sm overflow-hidden">
                                <CardContent className="p-4 md:p-5">
                                    <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                        {lang === 'ru' ? 'О себе' : 'O\'zim haqimda'}
                                    </h2>
                                    <div className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap">
                                        {resume.about}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Professional Timeline: Experience */}
                        {experienceList.length > 0 && (
                            <section className="space-y-6">
                                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3 px-1">
                                    <div className="w-1.5 h-7 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"></div>
                                    {lang === 'ru' ? 'Опыт работы' : 'Ish tajribasi'}
                                </h2>
                                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
                                    {experienceList.map((exp, idx) => {
                                        const position = exp?.position || exp?.role || exp?.title || '';
                                        const company = exp?.company || exp?.employer || exp?.organization || '';
                                        const start = exp?.start_date || exp?.start_year || exp?.start || '';
                                        const end = exp?.end_date || exp?.end_year || exp?.end || '';
                                        const timeLabel = start || end ? `${start || ''} - ${end || (lang === 'uz' ? 'Hozirgi' : 'Настоящее время')}` : '';
                                        return (
                                        <div key={idx} className="relative flex items-start gap-6 group">
                                            {/* Dot Icon */}
                                            <div className="flex items-center justify-center w-8 h-8 rounded-xl border-2 border-white bg-indigo-600 text-white shadow-lg shadow-indigo-200 shrink-0 z-10 transition-transform group-hover:scale-110 duration-300">
                                                <Briefcase className="w-4 h-4" />
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 p-5 rounded-3xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                                                    <div>
                                                        <div className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                                                            {position || (lang === 'uz' ? 'Lavozim' : 'Должность')}
                                                        </div>
                                                        {company && <div className="text-indigo-600 font-bold text-sm tracking-tight">{company}</div>}
                                                    </div>
                                                    {timeLabel && (
                                                        <time className="font-bold text-[10px] text-white bg-indigo-500/90 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm self-start">
                                                            {timeLabel}
                                                        </time>
                                                    )}
                                                </div>
                                                {exp?.description && (
                                                    <div className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap pl-0 border-l-0 border-slate-100">
                                                        {exp.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );})}
                                </div>
                            </section>
                        )}

                        {/* Professional Timeline: Education */}
                        {educationList.length > 0 && (
                            <section className="space-y-6">
                                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3 px-1">
                                    <div className="w-1.5 h-7 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"></div>
                                    {lang === 'ru' ? 'Образование' : "Ma'lumot"}
                                </h2>
                                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
                                    {educationList.map((edu, idx) => {
                                        const institution = edu?.institution || edu?.school || edu?.university || '';
                                        const field = edu?.field || edu?.specialty || edu?.faculty || '';
                                        const start = edu?.start_year || edu?.start_date || edu?.start || '';
                                        const end = edu?.end_year || edu?.end_date || edu?.end || '';
                                        const timeLabel = start || end ? `${start || ''} - ${end || (lang === 'uz' ? 'Hozirgi' : 'Настоящее время')}` : '';
                                        return (
                                        <div key={idx} className="relative flex items-start gap-6 group">
                                            {/* Dot Icon */}
                                            <div className="flex items-center justify-center w-8 h-8 rounded-xl border-2 border-white bg-indigo-600 text-white shadow-lg shadow-indigo-200 shrink-0 z-10 transition-transform group-hover:scale-110 duration-300">
                                                <GraduationCap className="w-4 h-4" />
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 p-5 rounded-3xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                                                    <div>
                                                        <div className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                                                            {institution || (lang === 'uz' ? 'O'quv muassasa' : 'Учебное заведение')}
                                                        </div>
                                                        {field && <div className="text-indigo-600 font-bold text-sm tracking-tight">{field}</div>}
                                                    </div>
                                                    {timeLabel && (
                                                        <time className="font-bold text-[10px] text-white bg-indigo-500/90 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm self-start">
                                                            {timeLabel}
                                                        </time>
                                                    )}
                                                </div>
                                                {edu?.degree && (
                                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-lg text-slate-500 text-[10px] font-bold border border-slate-100 uppercase tracking-wider">
                                                        {edu.degree}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );})}
                                </div>
                            </section>
                        )}

                        {/* Skills & Languages */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {skillsList.length > 0 && (
                                <Card className="border-slate-200/60 shadow-sm overflow-hidden rounded-3xl">
                                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-100">
                                        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-indigo-600" />
                                            {lang === 'ru' ? 'Профессиональные навыки' : "Ko'nikmalar"}
                                        </h3>
                                    </div>
                                    <CardContent className="p-5">
                                        <div className="flex flex-wrap gap-2">
                                            {skillsList.map((skill, idx) => (
                                                <Badge key={idx} variant="secondary" className="px-3 py-1.5 bg-indigo-50/50 text-indigo-700 border-indigo-100/50 text-[11px] font-bold rounded-xl transition-all hover:bg-indigo-100">
                                                    {skill}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {languageList.length > 0 && (
                                <Card className="border-slate-200/60 shadow-sm overflow-hidden rounded-3xl">
                                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-100">
                                        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                            <LanguagesIcon className="w-4 h-4 text-indigo-600" />
                                            {lang === 'ru' ? 'Владение языками' : 'Til bilish'}
                                        </h3>
                                    </div>
                                    <CardContent className="p-5">
                                        <div className="flex flex-col gap-3">
                                            {languageList.map((langItem, idx) => {
                                                const name = langItem?.name;
                                                const level = langItem?.level;
                                                if (!name) return null;

                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:border-indigo-100 hover:bg-white group">
                                                        <span className="font-extrabold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors">
                                                            {getLanguageLabel(name)}
                                                        </span>
                                                        {level && (
                                                            <Badge variant="outline" className="text-white border-none bg-indigo-600 shadow-md text-[10px] font-black py-0 h-6 px-3 rounded-lg flex items-center">
                                                                {level}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* SIDEBAR */}
                    <div className="space-y-6">
                        {/* Salary Widget */}
                        {(resume.expected_salary_min || resume.expected_salary_max) && (
                            <Card className="border border-slate-200 shadow-xl shadow-indigo-100/30 bg-white overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                                    <Banknote className="w-20 h-20 rotate-12 text-indigo-900" />
                                </div>
                                <CardContent className="p-5 md:p-6 relative">
                                    <p className="text-slate-500 font-medium text-[10px] mb-1 uppercase tracking-wider">{lang === 'ru' ? 'Ожидаемая зарплата' : 'Kutilayotgan maosh'}</p>
                                    <h3 className="text-xl md:text-2xl font-extrabold mb-1 text-slate-900">
                                        {formatSalary(resume.expected_salary_min, resume.expected_salary_max, lang)}
                                    </h3>
                                    <p className="text-slate-400 text-xs mb-6">{lang === 'ru' ? 'в месяц' : 'oyiga'}</p>

                                    <Button
                                        onClick={handleContact}
                                        className="w-full h-11 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold transition-all shadow-md text-sm"
                                    >
                                        <Mail className="w-4 h-4 mr-2" />
                                        {lang === 'ru' ? 'Предложить работу' : 'Ish taklif qilish'}
                                    </Button>
                                    <p className="text-center text-[10px] text-slate-400 mt-4">
                                        {lang === 'ru' ? 'Размещено' : 'Joylangan'}: {formatDate(resume.created_at, lang)}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Contact Card */}
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                                <h3 className="font-bold text-slate-900 text-sm">{lang === 'ru' ? 'Контактная информация' : 'Aloqa ma\'lumotlari'}</h3>
                            </div>
                            <CardContent className="p-4 md:p-5 space-y-4">
                                {resume.phone && (
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <Phone className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium">{lang === 'ru' ? 'Телефон' : 'Telefon'}</p>
                                                <p className="font-bold text-slate-900 text-sm">{resume.phone}</p>
                                            </div>
                                        </div>
                                        <a
                                            href={`tel:${resume.phone}`}
                                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                                        >
                                            <Phone className="w-4 h-4" />
                                        </a>
                                    </div>
                                )}

                                {(resume as any).telegram && (
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-.94-2.4-1.55-1.07-.7-.37-1.09.24-1.72.14-.15 2.54-2.32 2.59-2.52.01-.03.01-.15-.06-.21-.07-.06-.18-.04-.26-.02-.11.02-1.91 1.2-5.4 3.56-.51.35-.96.52-1.37.51-.45-.01-1.32-.26-1.96-.46-.79-.25-1.42-.38-1.36-.8.03-.21.32-.42.88-.63 3.44-1.5 5.75-2.49 6.92-2.97 3.29-1.35 3.98-1.58 4.43-1.58.1 0 .32.02.46.12.12.08.15.2.16.28 0 .09.01.27 0 .44z"></path></svg>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-medium">Telegram</p>
                                                <p className="font-bold text-slate-900 text-sm">@{(resume as any).telegram.replace('@', '')}</p>
                                            </div>
                                        </div>
                                        <a
                                            href={`https://t.me/${(resume as any).telegram.replace('@', '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-sky-500 hover:text-white transition-all"
                                        >
                                            <ArrowLeft className="w-4 h-4 -rotate-180" />
                                        </a>
                                    </div>
                                )}

                                {districtName && (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-medium">{lang === 'ru' ? 'Местоположение' : 'Manzil'}</p>
                                            <p className="font-bold text-slate-900 text-xs leading-tight">{districtName}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Actions Card */}
                        <Card className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-50 border-indigo-100 shadow-sm">
                            <h4 className="font-bold text-indigo-900 text-sm mb-3">{lang === 'ru' ? 'Для работодателя' : 'Ish beruvchi uchun'}</h4>
                            <div className="space-y-2.5">
                                <div className="flex items-start gap-2.5">
                                    <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-indigo-700" />
                                    </div>
                                    <p className="text-xs text-indigo-800">{lang === 'ru' ? 'Кандидат прошел проверку номера' : 'Nomzod raqami tasdiqlangan'}</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-indigo-700" />
                                    </div>
                                    <p className="text-xs text-indigo-800">{lang === 'ru' ? 'Профиль заполнен на 85%' : 'Profil 85% to\'ldirilgan'}</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
