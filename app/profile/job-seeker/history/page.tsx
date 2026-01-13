'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Briefcase, MapPin, Banknote, Loader2, Trash2 } from '@/components/ui/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatSalary } from '@/lib/constants';

interface ViewedJob {
    id: string;
    job_id: string;
    viewed_at: string;
    jobs: {
        id: string;
        title_uz: string;
        title_ru: string;
        company_name: string;
        salary_min: number | null;
        salary_max: number | null;
        employment_type: string;
        districts: {
            name_uz: string;
            name_ru: string;
        } | null;
    };
}

export default function HistoryPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [history, setHistory] = useState<ViewedJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('view_history')
                    .select(`
                        id,
                        job_id,
                        viewed_at,
                        jobs (
                            id,
                            title_uz,
                            title_ru,
                            company_name,
                            salary_min,
                            salary_max,
                            employment_type,
                            districts (
                                name_uz,
                                name_ru
                            )
                        )
                    `)
                    .eq('user_id', user.id)
                    .order('viewed_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                setHistory((data as any) || []);
            } catch (err) {
                console.error('Error fetching history:', err);
                toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Yuklashda xatolik');
            }
            setIsLoading(false);
        };

        fetchHistory();
    }, [user?.id, lang]);

    const clearHistory = async () => {
        if (!user?.id) return;
        if (!confirm(lang === 'ru' ? 'Очистить историю просмотров?' : 'Ko\'rish tarixini tozalashni xohlaysizmi?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('view_history')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
            setHistory([]);
            toast.success(lang === 'ru' ? 'История очищена' : 'Tarix tozalandi');
        } catch (err) {
            console.error('Error clearing history:', err);
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
                            {lang === 'ru' ? 'История просмотров' : 'Ko\'rish tarixi'}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {lang === 'ru' ? 'Недавно просмотренные вакансии' : 'Yaqinda ko\'rilgan vakansiyalar'}
                        </p>
                    </div>
                    {history.length > 0 && (
                        <Button variant="outline" onClick={clearHistory} className="gap-2 text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                            {lang === 'ru' ? 'Очистить' : 'Tozalash'}
                        </Button>
                    )}
                </div>

                {/* Empty state or list */}
                {history.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <Clock className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'История пуста' : 'Tarix bo\'sh'}
                            </h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Просмотренные вакансии появятся здесь'
                                    : 'Ko\'rilgan vakansiyalar bu yerda ko\'rinadi'}
                            </p>
                            <Button className="gap-2" asChild>
                                <Link href="/jobs">
                                    <Briefcase className="w-4 h-4" />
                                    {lang === 'ru' ? 'Найти вакансии' : 'Vakansiyalarni topish'}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => {
                            const job = item.jobs;
                            if (!job) return null;

                            return (
                                <Card key={item.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-900 hover:text-sky-600 transition-colors">
                                                    {lang === 'ru' ? job.title_ru : job.title_uz}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {job.company_name}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                                                    {job.districts && (
                                                        <span className="flex items-center gap-1 text-slate-500">
                                                            <MapPin className="w-4 h-4" />
                                                            {lang === 'ru' ? job.districts.name_ru : job.districts.name_uz}
                                                        </span>
                                                    )}
                                                    {(job.salary_min || job.salary_max) && (
                                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                            <Banknote className="w-4 h-4" />
                                                            {formatSalary(job.salary_min, job.salary_max, lang)}
                                                        </span>
                                                    )}
                                                    {job.employment_type && (
                                                        <Badge variant="secondary">
                                                            {job.employment_type}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </Link>
                                            <div className="text-right">
                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(item.viewed_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </ProfileLayout>
    );
}
