'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Briefcase, Loader2, Clock, CheckCircle, XCircle, MapPin, Banknote, ChevronRight } from '@/components/ui/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatSalary, formatDate } from '@/lib/constants';

interface Application {
    id: string;
    job_id: string;
    full_name: string;
    status: string;
    created_at: string;
    // Supabase returns relations as arrays, so we use any to handle both cases
    jobs?: any;
}

export default function ApplicationsPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchApplications = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                // Fetch applications with job details
                const { data, error } = await supabase
                    .from('job_applications')
                    .select(`
                        id,
                        job_id,
                        full_name,
                        status,
                        created_at,
                        jobs (
                            id,
                            title_uz,
                            title_ru,
                            company_name,
                            salary_min,
                            salary_max,
                            regions (name_uz, name_ru),
                            districts (name_uz, name_ru)
                        )
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setApplications(data || []);

                // Mark notifications as seen (for status changes)
                // We find apps that have status change (viewed/accepted) but NOT yet seen by job seeker
                // Note: user must run the SQL migration for 'is_seen_by_job_seeker' column first
                try {
                    const unseenApps = (data || []).filter((app: any) =>
                        ['viewed', 'accepted', 'rejected'].includes(app.status)
                    );

                    if (unseenApps.length > 0) {
                        const ids = unseenApps.map((a: any) => a.id);
                        await supabase
                            .from('job_applications')
                            .update({ is_seen_by_job_seeker: true })
                            .in('id', ids);

                        // Dispatch event to clear indicator
                        window.dispatchEvent(new CustomEvent('applicationsRead'));
                    }
                } catch (e) {
                    // Fail silently if column doesn't exist yet
                    console.log('Could not update seen status (column might be missing)');
                }

            } catch (err) {
                console.error('Error fetching applications:', err);
                // Try alternative: fetch by phone number match
                try {
                    const { data, error } = await supabase
                        .from('job_applications')
                        .select(`
                            id,
                            job_id,
                            full_name,
                            status,
                            created_at,
                            jobs (
                            id,
                            title_uz,
                            title_ru,
                            company_name,
                            salary_min,
                            salary_max,
                            districts (
                                name_uz,
                                name_ru,
                                regions (
                                    name_uz,
                                    name_ru
                                )
                            )
                        )
                    `)
                        .eq('phone', user.phone)
                        .order('created_at', { ascending: false });

                    if (!error) {
                        setApplications(data || []);
                    }
                } catch (e) {
                    console.error('Fallback fetch also failed:', e);
                }
            }
            setIsLoading(false);
        };

        fetchApplications();
    }, [user?.id, user?.phone]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
                        <Clock className="w-3 h-3 mr-1" />
                        {lang === 'ru' ? 'На рассмотрении' : 'Ko\'rib chiqilmoqda'}
                    </Badge>
                );
            case 'accepted':
                return (
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {lang === 'ru' ? 'Принято' : 'Qabul qilindi'}
                    </Badge>
                );
            case 'rejected':
                return (
                    <Badge variant="secondary" className="bg-red-50 text-red-700">
                        <XCircle className="w-3 h-3 mr-1" />
                        {lang === 'ru' ? 'Отклонено' : 'Rad etildi'}
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary">
                        {status}
                    </Badge>
                );
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
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Мои заявки' : 'Mening arizalarim'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Отслеживайте статус своих откликов' : 'Arizalaringiz holatini kuzating'}
                    </p>
                </div>

                {/* Empty state or list */}
                {applications.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <Send className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет заявок' : 'Arizalar yo\'q'}
                            </h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Найдите подходящую вакансию и откликнитесь'
                                    : 'Mos vakansiyani toping va ariza bering'}
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
                        {applications.map((app) => {
                            const job = Array.isArray(app.jobs) ? app.jobs[0] : app.jobs;
                            if (!job) return null;

                            const title = lang === 'ru' ? job.title_ru : job.title_uz;

                            // Correctly access nested location data
                            const district = job.districts;
                            const region = district?.regions;

                            const regionName = region ? (lang === 'ru' ? region.name_ru : region.name_uz) : '';
                            const districtName = district ? (lang === 'ru' ? district.name_ru : district.name_uz) : '';
                            const location = [regionName, districtName].filter(Boolean).join(', ');

                            return (
                                <Card key={app.id} className="group hover:shadow-lg transition-all border-slate-200 overflow-hidden">
                                    <CardContent className="p-0">
                                        <div className="flex">
                                            <div className={`w-1.5 ${app.status === 'accepted' ? 'bg-emerald-500' :
                                                app.status === 'rejected' ? 'bg-red-500' :
                                                    'bg-amber-400'
                                                }`} />
                                            <div className="flex-1 p-5">
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-start justify-between md:justify-start gap-4">
                                                            <div>
                                                                <h3 className="font-bold text-lg text-slate-900 group-hover:text-sky-600 transition-colors">
                                                                    {title}
                                                                </h3>
                                                                <p className="text-slate-600 font-medium">{job.company_name}</p>
                                                            </div>
                                                            <div className="md:hidden">
                                                                {getStatusBadge(app.status || 'pending')}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                                <Clock className="w-4 h-4" />
                                                                {formatDate(app.created_at, lang)}
                                                            </div>
                                                            {location && (
                                                                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                                                    <MapPin className="w-4 h-4" />
                                                                    {location}
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                                                                <Banknote className="w-4 h-4" />
                                                                {formatSalary(job.salary_min, job.salary_max, lang)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3">
                                                        <div className="hidden md:block">
                                                            {getStatusBadge(app.status || 'pending')}
                                                        </div>
                                                        <Button variant="outline" size="sm" className="gap-2 group/btn" asChild>
                                                            <Link href={`/jobs/${job.id}`}>
                                                                {lang === 'ru' ? 'Подробнее' : 'Batafsil'}
                                                                <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </div>
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
