'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, User, Briefcase, GraduationCap, Languages as LanguagesIcon,
    MapPin, Phone, Calendar, Loader2, Mail, CheckCircle, Banknote
} from '@/components/ui/icons';
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
    const { user: currentUser, isAuthenticated, switchRole } = useUserAuth();
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

    const handleRequireEmployerAccess = () => {
        if (!isAuthenticated || !currentUser) {
            toast.info(lang === 'uz'
                ? 'Rezyumeni ko‘rish uchun ish beruvchi sifatida kiring.'
                : 'Для просмотра резюме войдите как работодатель.');
            openModal();
            return;
        }

        if (currentUser.active_role === 'job_seeker') {
            if (currentUser.has_employer_profile) {
                toast.info(lang === 'uz'
                    ? 'Ish beruvchi roliga o‘tkazilmoqda...'
                    : 'Переключаем на роль работодателя...');
                switchRole('employer');
            } else {
                toast.error(lang === 'uz'
                    ? 'Sizda ish beruvchi profili yo‘q. Avval ish beruvchi profilini oching.'
                    : 'У вас нет профиля работодателя. Сначала создайте профиль работодателя.');
                openModal();
            }
        }
    };

    const handleContact = async () => {
        if (!resume) return;

        if (!isAuthenticated || !currentUser) {
            openModal();
            return;
        }

        const { data: employer } = await supabase
            .from('employer_profiles')
            .select('id')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (employer) {
            router.push(`/profile/employer/messages?chat_with=${resume.user_id}`);
        } else {
            toast.error(lang === 'uz' ? 'Faqat ish beruvchilar yozishi mumkin' : 'Только работодатели могут писать');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
    const isOwner = Boolean(currentUser?.id && currentUser.id === resume.user_id);
    const isEmployerViewer = Boolean(isAuthenticated && currentUser?.active_role === 'employer');
    const canViewResume = isOwner || isEmployerViewer;

    if (!canViewResume) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
                <div className="max-w-xl w-full bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                        {lang === 'uz'
                            ? 'Rezyume faqat ish beruvchilar uchun ochiq'
                            : 'Резюме доступно только работодателям'}
                    </h2>
                    <p className="text-slate-500 mb-6">
                        {lang === 'uz'
                            ? 'Davom etish uchun ish beruvchi sifatida tizimga kiring.'
                            : 'Чтобы продолжить, войдите в систему как работодатель.'}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <Button onClick={handleRequireEmployerAccess}>
                            {lang === 'uz' ? 'Ish beruvchi sifatida kirish' : 'Войти как работодатель'}
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/resumes')}>
                            {lang === 'uz' ? 'Orqaga qaytish' : 'Вернуться назад'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ===== COMPACT PROFILE HEADER ===== */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 pt-28 pb-8">
                {/* Background orbs */}
                <div className="absolute top-0 right-[15%] w-[250px] h-[250px] bg-blue-500/12 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-[10%] w-[180px] h-[180px] bg-teal-500/8 rounded-full blur-[60px] pointer-events-none" />

                <div className="container relative mx-auto px-4 z-10">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="text-slate-400 hover:text-white hover:bg-white/10 mb-5 -ml-2 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        {lang === 'uz' ? 'Orqaga' : 'Назад'}
                    </Button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                        <div className="flex items-center gap-5">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-xl shadow-blue-500/20">
                                    {(resume.full_name || resume.title || 'I').charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-400 rounded-full border-2 border-slate-900" />
                            </div>

                            {/* Name + meta */}
                            <div className="min-w-0">
                                <h1 className="text-xl md:text-2xl font-bold text-white truncate leading-tight mb-1">
                                    {resume.title || (lang === 'ru' ? 'Специалист' : 'Mutaxassis')}
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                                    <span className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" />
                                        {resume.full_name || (lang === 'ru' ? 'Имя не указано' : "Ism ko'rsatilmagan")}
                                    </span>
                                    {resume.birth_date && (
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {calculateAge(resume.birth_date)} {lang === 'ru' ? 'лет' : 'yosh'}
                                        </span>
                                    )}
                                    {isOwner && districtName && (
                                        <span className="flex items-center gap-1.5 text-teal-400/80">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {districtName}
                                        </span>
                                    )}
                                </div>
                                {/* Badges */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    <Badge className="bg-white/8 backdrop-blur text-slate-300 border-white/10 text-[10px] px-2 py-0.5">
                                        {getEducationLabel(resume.education_level || '')}
                                    </Badge>
                                    <Badge className="bg-blue-500/15 text-blue-300 border-blue-400/20 text-[10px] px-2 py-0.5">
                                        {getExperienceLabel(resume.experience)}
                                    </Badge>
                                    {resume.employment_type && (
                                        <Badge className="bg-teal-500/15 text-teal-300 border-teal-400/20 text-[10px] px-2 py-0.5">
                                            {resume.employment_type === 'full_time' ? (lang === 'uz' ? 'To\'liq' : 'Полная') :
                                                resume.employment_type === 'part_time' ? (lang === 'uz' ? 'Yarim' : 'Частичная') :
                                                    resume.employment_type}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CTA button */}
                        {isEmployerViewer && (
                            <Button
                                onClick={handleContact}
                                className="w-full md:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]"
                            >
                                <Mail className="w-4 h-4" />
                                {lang === 'ru' ? 'Написать' : 'Xabar yozish'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="container mx-auto px-4 py-6 md:py-8">
                <div className="grid lg:grid-cols-3 gap-6 md:gap-8">

                    {/* LEFT COLUMN — Main info */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* About */}
                        {resume.about && (
                            <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <User className="w-3.5 h-3.5 text-blue-600" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-900">
                                        {lang === 'ru' ? 'О себе' : 'O\'zim haqimda'}
                                    </h2>
                                </div>
                                <CardContent className="p-5">
                                    <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                        {resume.about}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Experience */}
                        {experienceList.length > 0 && (
                            <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                        <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-900">
                                        {lang === 'ru' ? 'Опыт работы' : 'Ish tajribasi'}
                                    </h2>
                                </div>
                                <CardContent className="p-5">
                                    <div className="space-y-4">
                                        {experienceList.map((exp, idx) => {
                                            const position = exp?.position || exp?.role || exp?.title || '';
                                            const company = exp?.company || exp?.employer || exp?.organization || '';
                                            const start = exp?.start_date || exp?.start_year || exp?.start || '';
                                            const end = exp?.end_date || exp?.end_year || exp?.end || '';
                                            const timeLabel = start || end ? `${start || ''} — ${end || (lang === 'uz' ? 'Hozirgi' : 'Настоящее время')}` : '';
                                            return (
                                                <div key={idx} className={`flex gap-4 ${idx > 0 ? 'pt-4 border-t border-slate-100' : ''}`}>
                                                    <div className="flex-shrink-0 pt-0.5">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-1 mb-1">
                                                            <div>
                                                                <div className="font-semibold text-slate-900 text-sm">
                                                                    {position || (lang === 'uz' ? 'Lavozim' : 'Должность')}
                                                                </div>
                                                                {company && <div className="text-blue-600 text-xs font-medium">{company}</div>}
                                                            </div>
                                                            {timeLabel && (
                                                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium whitespace-nowrap self-start">
                                                                    {timeLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {exp?.description && (
                                                            <p className="text-slate-500 text-xs leading-relaxed mt-1 whitespace-pre-wrap">{exp.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Education */}
                        {educationList.length > 0 && (
                            <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                                    <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                                        <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-900">
                                        {lang === 'ru' ? 'Образование' : "Ma'lumot"}
                                    </h2>
                                </div>
                                <CardContent className="p-5">
                                    <div className="space-y-4">
                                        {educationList.map((edu, idx) => {
                                            const institution = edu?.institution || edu?.school || edu?.university || '';
                                            const field = edu?.field || edu?.specialty || edu?.faculty || '';
                                            const start = edu?.start_year || edu?.start_date || edu?.start || '';
                                            const end = edu?.end_year || edu?.end_date || edu?.end || '';
                                            const timeLabel = start || end ? `${start || ''} — ${end || (lang === 'uz' ? 'Hozirgi' : 'Настоящее время')}` : '';
                                            return (
                                                <div key={idx} className={`flex gap-4 ${idx > 0 ? 'pt-4 border-t border-slate-100' : ''}`}>
                                                    <div className="flex-shrink-0 pt-0.5">
                                                        <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-1 mb-1">
                                                            <div>
                                                                <div className="font-semibold text-slate-900 text-sm">
                                                                    {institution || (lang === 'uz' ? "O'quv muassasa" : 'Учебное заведение')}
                                                                </div>
                                                                {field && <div className="text-teal-600 text-xs font-medium">{field}</div>}
                                                            </div>
                                                            {timeLabel && (
                                                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium whitespace-nowrap self-start">
                                                                    {timeLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {edu?.degree && (
                                                            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded border border-slate-200">
                                                                {edu.degree}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Skills & Languages */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {skillsList.length > 0 && (
                                <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                        <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                                            <CheckCircle className="w-3 h-3 text-violet-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-xs">
                                            {lang === 'ru' ? 'Навыки' : "Ko'nikmalar"}
                                        </h3>
                                    </div>
                                    <CardContent className="p-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {skillsList.map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium rounded-lg transition-all hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {languageList.length > 0 && (
                                <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                        <div className="w-6 h-6 rounded-md bg-cyan-100 flex items-center justify-center">
                                            <LanguagesIcon className="w-3 h-3 text-cyan-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-xs">
                                            {lang === 'ru' ? 'Языки' : 'Tillar'}
                                        </h3>
                                    </div>
                                    <CardContent className="p-4">
                                        <div className="space-y-2">
                                            {languageList.map((langItem, idx) => {
                                                const name = langItem?.name;
                                                const level = langItem?.level;
                                                if (!name) return null;

                                                return (
                                                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-all">
                                                        <span className="font-semibold text-slate-800 text-xs">
                                                            {getLanguageLabel(name)}
                                                        </span>
                                                        {level && (
                                                            <Badge variant="outline" className="text-white border-none bg-slate-700 text-[9px] font-medium py-0 h-5 px-2 rounded">
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

                    {/* RIGHT COLUMN — Sidebar */}
                    <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">

                        {/* Salary Card */}
                        {(resume.expected_salary_min || resume.expected_salary_max) && (
                            <Card className="border-slate-200 shadow-sm bg-white rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                                <CardContent className="p-5">
                                    <p className="text-slate-500 font-medium text-[10px] mb-1 uppercase tracking-wider">{lang === 'ru' ? 'Ожидаемая зарплата' : 'Kutilayotgan maosh'}</p>
                                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-0.5">
                                        {formatSalary(resume.expected_salary_min, resume.expected_salary_max, lang)}
                                    </h3>
                                    <p className="text-slate-400 text-xs mb-4">{lang === 'ru' ? 'в месяц' : 'oyiga'}</p>

                                    {isEmployerViewer && (
                                        <Button
                                            onClick={handleContact}
                                            className="w-full h-10 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 font-semibold transition-all text-sm shadow-md shadow-blue-500/15 hover:shadow-blue-500/25"
                                        >
                                            <Mail className="w-4 h-4 mr-2" />
                                            {lang === 'ru' ? 'Предложить работу' : 'Ish taklif qilish'}
                                        </Button>
                                    )}
                                    <p className="text-center text-[10px] text-slate-400 mt-3">
                                        {lang === 'ru' ? 'Размещено' : 'Joylangan'}: {formatDate(resume.created_at, lang)}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Contact Card */}
                        <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-bold text-slate-900 text-xs">{lang === 'ru' ? 'Контакты' : 'Aloqa'}</h3>
                            </div>
                            <CardContent className="p-4 space-y-3">
                                {resume.phone && (isEmployerViewer || isOwner) && (
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-slate-400 font-medium uppercase">{lang === 'ru' ? 'Телефон' : 'Telefon'}</p>
                                                <p className="font-bold text-slate-900 text-xs">{resume.phone}</p>
                                            </div>
                                        </div>
                                        <a
                                            href={`tel:${resume.phone}`}
                                            className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                )}

                                {(resume as any).telegram && (
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-.94-2.4-1.55-1.07-.7-.37-1.09.24-1.72.14-.15 2.54-2.32 2.59-2.52.01-.03.01-.15-.06-.21-.07-.06-.18-.04-.26-.02-.11.02-1.91 1.2-5.4 3.56-.51.35-.96.52-1.37.51-.45-.01-1.32-.26-1.96-.46-.79-.25-1.42-.38-1.36-.8.03-.21.32-.42.88-.63 3.44-1.5 5.75-2.49 6.92-2.97 3.29-1.35 3.98-1.58 4.43-1.58.1 0 .32.02.46.12.12.08.15.2.16.28 0 .09.01.27 0 .44z"></path></svg>
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-slate-400 font-medium uppercase">Telegram</p>
                                                <p className="font-bold text-slate-900 text-xs">@{(resume as any).telegram.replace('@', '')}</p>
                                            </div>
                                        </div>
                                        <a
                                            href={`https://t.me/${(resume as any).telegram.replace('@', '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5 -rotate-180" />
                                        </a>
                                    </div>
                                )}

                                {isOwner && districtName && (
                                    <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                            <MapPin className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 font-medium uppercase">{lang === 'ru' ? 'Местоположение' : 'Manzil'}</p>
                                            <p className="font-bold text-slate-900 text-xs leading-tight">{districtName}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Trust Card */}
                        <Card className="p-4 bg-slate-50 border-slate-200 shadow-sm rounded-xl">
                            <h4 className="font-bold text-slate-900 text-xs mb-3">{lang === 'ru' ? 'Для работодателя' : 'Ish beruvchi uchun'}</h4>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-2.5 h-2.5 text-blue-600" />
                                    </div>
                                    <p className="text-[11px] text-slate-600">{lang === 'ru' ? 'Кандидат прошел проверку номера' : 'Nomzod raqami tasdiqlangan'}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle className="w-2.5 h-2.5 text-blue-600" />
                                    </div>
                                    <p className="text-[11px] text-slate-600">{lang === 'ru' ? 'Профиль заполнен на 85%' : 'Profil 85% to\'ldirilgan'}</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
