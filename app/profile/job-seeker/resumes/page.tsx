'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Eye, Edit3, Trash2, MoreVertical, Loader2, MapPin, Briefcase, Banknote, Clock, CheckCircle, PartyPopper } from '@/components/ui/icons';
import { Switch } from '@/components/ui/switch';
import { formatSalary } from '@/lib/constants';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Resume {
    id: string;
    title: string;
    full_name: string | null;
    is_public: boolean;
    status: string;
    created_at: string;
}

export default function ResumesPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [resumes, setResumes] = useState<any[]>([]);
    const [regions, setRegions] = useState<any[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchResumes = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                // Fetch regions and districts if not already fetched
                const [cats, regs, dists] = await Promise.all([
                    Promise.resolve(null), // categories not needed here yet
                    supabase.from('regions').select('*').order('name_uz'),
                    supabase.from('districts').select('*').order('name_uz'),
                ]);

                if (regs.data) setRegions(regs.data);
                if (dists.data) setDistricts(dists.data);

                const { data, error } = await supabase
                    .from('resumes')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Enrich resumes with district and region info in-memory
                const enrichedData = (data || []).map(resume => {
                    if (resume.district_id) {
                        const district = (dists.data || []).find(d => d.id === resume.district_id);
                        const region = (regs.data || []).find(r => r.id === district?.region_id);
                        return {
                            ...resume,
                            districts: district ? {
                                ...district,
                                regions: region
                            } : null
                        };
                    }
                    return resume;
                });

                setResumes(enrichedData);
            } catch (err) {
                console.error('Error fetching resumes:', err);
                toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Yuklashda xatolik');
            }
            setIsLoading(false);
        };

        fetchResumes();
    }, [user?.id, lang]);

    const handleDelete = async (resumeId: string) => {
        if (!confirm(lang === 'ru' ? 'Удалить резюме?' : 'Rezyumeni o\'chirmoqchimisiz?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('resumes')
                .delete()
                .eq('id', resumeId);

            if (error) throw error;

            setResumes(resumes.filter(r => r.id !== resumeId));
            toast.success(lang === 'ru' ? 'Удалено' : 'O\'chirildi');
        } catch (err) {
            console.error('Error deleting resume:', err);
            toast.error(lang === 'ru' ? 'Ошибка удаления' : 'O\'chirishda xatolik');
        }
    };

    const handleTogglePublic = async (resumeId: string, currentValue: boolean) => {
        try {
            const { error } = await supabase
                .from('resumes')
                .update({ is_public: !currentValue })
                .eq('id', resumeId);

            if (error) throw error;

            setResumes(resumes.map(r =>
                r.id === resumeId ? { ...r, is_public: !currentValue } : r
            ));
            toast.success(lang === 'ru' ? 'Статус изменен' : 'Holat o\'zgartirildi');
        } catch (err) {
            console.error('Error toggling resume:', err);
            toast.error(lang === 'ru' ? 'Ошибка' : 'Xatolik');
        }
    };

    const handleFoundJob = async (resumeId: string) => {
        try {
            const { error } = await supabase
                .from('resumes')
                .update({
                    found_job: true,
                    is_public: false,
                    found_job_at: new Date().toISOString()
                })
                .eq('id', resumeId);

            if (error) throw error;

            setResumes(resumes.map(r =>
                r.id === resumeId ? { ...r, found_job: true, is_public: false } : r
            ));
            toast.success(lang === 'ru' ? 'Поздравляем с новой работой! 🎉' : 'Yangi ish bilan tabriklaymiz! 🎉');
        } catch (err) {
            console.error('Error marking found job:', err);
            toast.error(lang === 'ru' ? 'Ошибка' : 'Xatolik');
        }
    };

    if (isLoading) {
        return (
            <ProfileLayout userType="job_seeker" userName="Foydalanuvchi">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="job_seeker" userName="Foydalanuvchi">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {lang === 'ru' ? 'Мои резюме' : 'Mening rezyumelarim'}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {lang === 'ru' ? 'Управляйте своими резюме' : 'Rezyumelaringizni boshqaring'}
                        </p>
                    </div>
                    <Button className="gap-2" asChild>
                        <Link href="/profile/job-seeker/resumes/new">
                            <Plus className="w-4 h-4" />
                            {lang === 'ru' ? 'Создать резюме' : 'Rezyume yaratish'}
                        </Link>
                    </Button>
                </div>

                {/* Empty state or list */}
                {resumes.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <FileText className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет резюме' : 'Rezyume yo\'q'}
                            </h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Создайте резюме, чтобы откликаться на вакансии'
                                    : 'Vakansiyalarga ariza berish uchun rezyume yarating'}
                            </p>
                            <Button className="gap-2" asChild>
                                <Link href="/profile/job-seeker/resumes/new">
                                    <Plus className="w-4 h-4" />
                                    {lang === 'ru' ? 'Создать первое резюме' : 'Birinchi rezyumeni yaratish'}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {resumes.map((resume: any) => (
                            <Card key={resume.id} className="hover:shadow-md transition-shadow group relative border-slate-200">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg text-slate-900 line-clamp-1 group-hover:text-violet-600 transition-colors">
                                                {resume.title}
                                            </h3>
                                            <p className="text-slate-600 font-medium">
                                                {resume.full_name || (lang === 'ru' ? 'Имя не указано' : 'Ism ko\'rsatilmagan')}
                                            </p>
                                        </div>

                                        {/* Actions Area */}
                                        <div className="flex items-center gap-3">
                                            {/* Found Job Badge or Visibility Toggle */}
                                            {resume.found_job ? (
                                                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    {lang === 'ru' ? 'Нашёл работу' : 'Ish topdi'}
                                                </Badge>
                                            ) : (
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Switch
                                                        checked={resume.is_public}
                                                        onCheckedChange={() => handleTogglePublic(resume.id, resume.is_public)}
                                                        className="data-[state=checked]:bg-emerald-500"
                                                    />
                                                    <span className={`text-xs font-medium ${resume.is_public ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                        {resume.is_public ? (lang === 'ru' ? 'Активно' : 'Faol') : (lang === 'ru' ? 'Скрыто' : 'Yashirin')}
                                                    </span>
                                                </div>
                                            )}

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/profile/job-seeker/resumes/${resume.id}`}>
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            {lang === 'ru' ? 'Просмотр' : 'Ko\'rish'}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/profile/job-seeker/resumes/${resume.id}`}>
                                                            <Edit3 className="w-4 h-4 mr-2" />
                                                            {lang === 'ru' ? 'Редактировать' : 'Tahrirlash'}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {!resume.found_job && (
                                                        <DropdownMenuItem
                                                            className="text-green-600"
                                                            onClick={() => handleFoundJob(resume.id)}
                                                        >
                                                            <CheckCircle className="w-4 h-4 mr-2" />
                                                            {lang === 'ru' ? 'Нашёл работу' : 'Ish topdim'}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(resume.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        {lang === 'ru' ? 'Удалить' : 'O\'chirish'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    {/* Link wrapper for the clickable body area */}
                                    <Link href={`/profile/job-seeker/resumes/${resume.id}`} className="block flex-1">
                                        <div className="space-y-3 mt-2">
                                            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                                                {/* Location - show district name */}
                                                {resume.districts && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="w-4 h-4 text-emerald-500" />
                                                        <span>
                                                            {(() => {
                                                                const district = Array.isArray(resume.districts) ? resume.districts[0] : resume.districts;
                                                                const region = district?.regions;
                                                                const regionName = lang === 'uz' ? region?.name_uz : region?.name_ru;
                                                                const districtName = lang === 'uz' ? district?.name_uz : district?.name_ru;
                                                                return regionName ? `${regionName}, ${districtName}` : districtName;
                                                            })()}
                                                        </span>
                                                    </div>
                                                )}
                                                {resume.experience_years !== null && resume.experience_years !== undefined && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Briefcase className="w-4 h-4 text-indigo-500" />
                                                        <span>
                                                            {resume.experience_years === 0
                                                                ? (lang === 'uz' ? 'Tajribasiz' : 'Без опыта')
                                                                : `${resume.experience_years} ${lang === 'uz' ? 'yil' : 'лет'}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Salary */}
                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                                <Banknote className="w-4 h-4 text-orange-500" />
                                                <span>
                                                    {(resume.expected_salary_min || resume.expected_salary_max)
                                                        ? formatSalary(resume.expected_salary_min, resume.expected_salary_max, lang)
                                                        : (lang === 'ru' ? 'Договорная' : 'Kelishiladi')
                                                    }
                                                </span>
                                            </div>

                                            {/* Skills */}
                                            {resume.skills && resume.skills.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {resume.skills.slice(0, 3).map((skill: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 border-0">
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                    {resume.skills.length > 3 && (
                                                        <span className="text-xs text-slate-400 px-1">+{resume.skills.length - 3}</span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="pt-2 text-xs text-slate-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(resume.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </ProfileLayout>
    );
}
