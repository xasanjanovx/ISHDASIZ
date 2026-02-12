'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    BarChart3, Eye, Users, TrendingUp, Briefcase, Loader2
} from '@/components/ui/icons';
import { supabase } from '@/lib/supabase';
import { fetchEmployerOwnedJobs } from '@/lib/employer-jobs';

interface VacancyStats {
    id: string;
    title_uz: string;
    title_ru: string;
    views_count: number;
    applications_count: number;
    status: string;
    is_active?: boolean | null;
    created_at: string;
}

interface OverallStats {
    totalVacancies: number;
    totalViews: number;
    totalApplications: number;
    activeVacancies: number;
    averageConversion: number;
}

export default function EmployerStatsPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [vacancies, setVacancies] = useState<VacancyStats[]>([]);
    const [stats, setStats] = useState<OverallStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const jobsList = await fetchEmployerOwnedJobs(supabase, user.id, {
                    select: 'id, title_uz, title_ru, views_count, status, is_active, created_at, employer_id, created_by, user_id',
                    limit: 500
                });

                // Get application counts for all jobs
                const jobIds = jobsList.map(j => j.id);
                let applicationCounts: Record<string, number> = {};

                if (jobIds.length > 0) {
                    const { data: apps } = await supabase
                        .from('job_applications')
                        .select('job_id')
                        .in('job_id', jobIds);

                    if (apps) {
                        apps.forEach(app => {
                            applicationCounts[app.job_id] = (applicationCounts[app.job_id] || 0) + 1;
                        });
                    }
                }

                // Merge counts
                const jobs = jobsList.map(j => ({
                    ...j,
                    applications_count: applicationCounts[j.id] || 0
                }));

                setVacancies(jobs);

                // Calculate overall stats
                const totalVacancies = jobs.length;
                const totalViews = jobs.reduce((sum, j) => sum + (j.views_count || 0), 0);
                const totalApplications = jobs.reduce((sum, j) => sum + (j.applications_count || 0), 0);
                const activeVacancies = jobs.filter(j => {
                    const status = String(j.status || '').toLowerCase();
                    if (status === 'filled' || status === 'closed' || status === 'archived') return false;
                    if (status === 'inactive' || status === 'paused' || status === 'on_hold') return false;
                    if (typeof j.is_active === 'boolean') return j.is_active;
                    return status ? status === 'active' : true;
                }).length;
                const averageConversion = totalViews > 0 ? (totalApplications / totalViews) * 100 : 0;

                setStats({
                    totalVacancies,
                    totalViews,
                    totalApplications,
                    activeVacancies,
                    averageConversion,
                });
            } catch (err) {
                console.error('Error fetching stats:', err);
            }
            setIsLoading(false);
        };

        fetchStats();
    }, [user?.id]);

    if (isLoading) {
        return (
            <ProfileLayout userType="employer" userName="Kompaniya">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="employer" userName="Kompaniya">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Статистика' : 'Statistika'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Аналитика ваших вакансий' : 'Vakansiyalaringiz tahlili'}
                    </p>
                </div>

                {/* Overall Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Briefcase className="w-8 h-8 mx-auto mb-2 text-violet-500" />
                                <p className="text-2xl font-bold text-slate-900">{stats.totalVacancies}</p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru' ? 'Всего вакансий' : 'Jami vakansiyalar'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Briefcase className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="text-2xl font-bold text-slate-900">{stats.activeVacancies}</p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru' ? 'Активных' : 'Faol'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Eye className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                <p className="text-2xl font-bold text-slate-900">{stats.totalViews}</p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru' ? 'Просмотров' : 'Ko\'rishlar'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Users className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                                <p className="text-2xl font-bold text-slate-900">{stats.totalApplications}</p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru' ? 'Откликов' : 'Arizalar'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                <p className="text-2xl font-bold text-slate-900">{stats.averageConversion.toFixed(1)}%</p>
                                <p className="text-sm text-slate-500">
                                    {lang === 'ru' ? 'Конверсия' : 'Konversiya'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Per-Vacancy Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            {lang === 'ru' ? 'По вакансиям' : 'Vakansiyalar bo\'yicha'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {vacancies.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                {lang === 'ru' ? 'Нет вакансий' : 'Vakansiyalar yo\'q'}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {vacancies.map((vacancy) => {
                                    const conversion = vacancy.views_count > 0
                                        ? ((vacancy.applications_count || 0) / vacancy.views_count) * 100
                                        : 0;

                                    return (
                                        <div
                                            key={vacancy.id}
                                            className="p-4 bg-slate-50 rounded-lg"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h4 className="font-medium text-slate-900">
                                                        {lang === 'ru' ? vacancy.title_ru : vacancy.title_uz}
                                                    </h4>
                                                    <p className="text-xs text-slate-400">
                                                        {new Date(vacancy.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <Badge variant={vacancy.status === 'active' ? 'default' : 'secondary'}>
                                                    {vacancy.status === 'active'
                                                        ? (lang === 'ru' ? 'Активная' : 'Faol')
                                                        : (lang === 'ru' ? 'Неактивная' : 'Nofaol')}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="text-center p-2 bg-white rounded">
                                                    <p className="text-lg font-semibold text-blue-600">
                                                        {vacancy.views_count || 0}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {lang === 'ru' ? 'Просмотров' : 'Ko\'rishlar'}
                                                    </p>
                                                </div>
                                                <div className="text-center p-2 bg-white rounded">
                                                    <p className="text-lg font-semibold text-orange-600">
                                                        {vacancy.applications_count || 0}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {lang === 'ru' ? 'Откликов' : 'Arizalar'}
                                                    </p>
                                                </div>
                                                <div className="text-center p-2 bg-white rounded">
                                                    <p className="text-lg font-semibold text-emerald-600">
                                                        {conversion.toFixed(1)}%
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {lang === 'ru' ? 'Конверсия' : 'Konversiya'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Simple visual bar */}
                                            <div className="mt-3">
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                                                        style={{ width: `${Math.min(conversion * 5, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ProfileLayout>
    );
}
