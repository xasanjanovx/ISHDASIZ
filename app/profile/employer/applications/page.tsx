'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Users, Loader2, Eye, Phone, Mail, FileText, Clock,
    CheckCircle, XCircle, Calendar
} from '@/components/ui/icons';
import { supabase } from '@/lib/supabase';
import { fetchEmployerOwnedJobs } from '@/lib/employer-jobs';
import { toast } from 'sonner';

interface Application {
    id: string;
    job_id: string;
    full_name: string;
    phone: string;
    email: string | null;
    message: string | null;
    status: string;
    created_at: string;
    viewed_at: string | null;
    resume_id: string | null;
    jobs: {
        id: string;
        title_uz: string;
        title_ru: string;
    } | null;
    resumes: {
        id: string;
        title: string;
        full_name: string | null;
        about: string | null;
        skills: string[] | null;
        experience: any[] | null;
    } | null;
}

const statusOptions = [
    { value: 'pending', label_uz: 'Yangi', label_ru: 'Новый', color: 'bg-blue-100 text-blue-700' },
    { value: 'viewed', label_uz: 'Ko\'rildi', label_ru: 'Просмотрен', color: 'bg-gray-100 text-gray-700' },
    { value: 'invited', label_uz: 'Taklif qilindi', label_ru: 'Приглашен', color: 'bg-green-100 text-green-700' },
    { value: 'rejected', label_uz: 'Rad etildi', label_ru: 'Отклонен', color: 'bg-red-100 text-red-700' },
    { value: 'hired', label_uz: 'Ishga olindi', label_ru: 'Принят', color: 'bg-emerald-100 text-emerald-700' },
];

export default function EmployerApplicationsPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        const fetchApplications = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const jobs = await fetchEmployerOwnedJobs(supabase, user.id, {
                    select: 'id, employer_id, created_by, user_id, created_at',
                    limit: 500
                });

                if (!jobs || jobs.length === 0) {
                    setApplications([]);
                    setIsLoading(false);
                    return;
                }

                const jobIds = jobs.map(j => j.id);

                // Get applications for these jobs
                const { data, error } = await supabase
                    .from('job_applications')
                    .select(`
                        id,
                        job_id,
                        full_name,
                        phone,
                        email,
                        message,
                        status,
                        created_at,
                        viewed_at,
                        resume_id,
                        jobs (
                            id,
                            title_uz,
                            title_ru
                        ),
                        resumes (
                            id,
                            title,
                            full_name,
                            about,
                            skills,
                            experience
                        )
                    `)
                    .in('job_id', jobIds)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setApplications((data as any) || []);

                // Auto-mark pending applications as viewed
                const pendingApps = (data || []).filter((app: any) => app.status === 'pending');
                if (pendingApps.length > 0) {
                    const pendingIds = pendingApps.map((app: any) => app.id);
                    await supabase
                        .from('job_applications')
                        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
                        .in('id', pendingIds);

                    // Update local state
                    setApplications(prev => prev.map(app =>
                        pendingIds.includes(app.id)
                            ? { ...app, status: 'viewed', viewed_at: new Date().toISOString() }
                            : app
                    ));

                    // Dispatch event to update indicators
                    window.dispatchEvent(new CustomEvent('applicationsRead'));
                }
            } catch (err) {
                console.error('Error fetching applications:', err);
                toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Yuklashda xatolik');
            }
            setIsLoading(false);
        };

        fetchApplications();
    }, [user?.id, lang]);

    const updateStatus = async (appId: string, newStatus: string) => {
        try {
            const updateData: any = { status: newStatus };
            if (newStatus === 'viewed' || !applications.find(a => a.id === appId)?.viewed_at) {
                updateData.viewed_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('job_applications')
                .update(updateData)
                .eq('id', appId);

            if (error) throw error;

            setApplications(apps =>
                apps.map(a => a.id === appId ? { ...a, status: newStatus, viewed_at: updateData.viewed_at || a.viewed_at } : a)
            );
            toast.success(lang === 'ru' ? 'Статус обновлен' : 'Status yangilandi');
        } catch (err) {
            console.error('Error updating status:', err);
            toast.error(lang === 'ru' ? 'Ошибка' : 'Xatolik');
        }
    };

    const getStatusBadge = (status: string) => {
        const opt = statusOptions.find(s => s.value === status) || statusOptions[0];
        return (
            <Badge className={opt.color}>
                {lang === 'ru' ? opt.label_ru : opt.label_uz}
            </Badge>
        );
    };

    const filteredApplications = filterStatus === 'all'
        ? applications
        : applications.filter(a => a.status === filterStatus);

    const stats = {
        total: applications.length,
        pending: applications.filter(a => a.status === 'pending').length,
        invited: applications.filter(a => a.status === 'invited').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
    };

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
                        {lang === 'ru' ? 'Отклики на вакансии' : 'Vakansiyalarga arizalar'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Управляйте откликами соискателей' : 'Nomzodlar arizalarini boshqaring'}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                            <p className="text-sm text-slate-500">{lang === 'ru' ? 'Всего' : 'Jami'}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
                            <p className="text-sm text-slate-500">{lang === 'ru' ? 'Новые' : 'Yangi'}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-green-600">{stats.invited}</p>
                            <p className="text-sm text-slate-500">{lang === 'ru' ? 'Приглашены' : 'Taklif qilingan'}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                            <p className="text-sm text-slate-500">{lang === 'ru' ? 'Отклонены' : 'Rad etilgan'}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600">{lang === 'ru' ? 'Фильтр:' : 'Filtr:'}</span>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{lang === 'ru' ? 'Все' : 'Hammasi'}</SelectItem>
                            {statusOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {lang === 'ru' ? opt.label_ru : opt.label_uz}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Applications List */}
                {filteredApplications.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет откликов' : 'Arizalar yo\'q'}
                            </h3>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Когда соискатели откликнутся на ваши вакансии, они появятся здесь'
                                    : 'Nomzodlar vakansiyalaringizga ariza berganda, ular shu yerda ko\'rinadi'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filteredApplications.map((app) => {
                            const job = Array.isArray(app.jobs) ? app.jobs[0] : app.jobs;

                            return (
                                <Card key={app.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="font-semibold text-slate-900">
                                                        {app.full_name}
                                                    </h3>
                                                    {getStatusBadge(app.status || 'pending')}
                                                </div>
                                                <p className="text-sm text-slate-500 mb-2">
                                                    {lang === 'ru' ? 'На вакансию:' : 'Vakansiyaga:'}{' '}
                                                    <span className="font-medium text-slate-700">
                                                        {job ? (lang === 'ru' ? job.title_ru : job.title_uz) : '-'}
                                                    </span>
                                                </p>
                                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                                    <a href={`tel:${app.phone}`} className="flex items-center gap-1 hover:text-sky-600">
                                                        <Phone className="w-4 h-4" />
                                                        {app.phone}
                                                    </a>
                                                    {app.email && (
                                                        <a href={`mailto:${app.email}`} className="flex items-center gap-1 hover:text-sky-600">
                                                            <Mail className="w-4 h-4" />
                                                            {app.email}
                                                        </a>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {new Date(app.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={app.status || 'pending'}
                                                    onValueChange={(value) => updateStatus(app.id, value)}
                                                >
                                                    <SelectTrigger className="w-[140px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {statusOptions.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {lang === 'ru' ? opt.label_ru : opt.label_uz}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setSelectedApp(app)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        {app.message && (
                                            <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                                <p className="text-sm text-slate-600">{app.message}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Application Detail Dialog */}
                <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {lang === 'ru' ? 'Детали отклика' : 'Ariza tafsilotlari'}
                            </DialogTitle>
                        </DialogHeader>
                        {selectedApp && (
                            <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-slate-500">{lang === 'ru' ? 'Имя' : 'Ism'}</label>
                                        <p className="font-medium">{selectedApp.full_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-500">{lang === 'ru' ? 'Телефон' : 'Telefon'}</label>
                                        <p className="font-medium">{selectedApp.phone}</p>
                                    </div>
                                    {selectedApp.email && (
                                        <div>
                                            <label className="text-sm text-slate-500">Email</label>
                                            <p className="font-medium">{selectedApp.email}</p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-sm text-slate-500">{lang === 'ru' ? 'Дата' : 'Sana'}</label>
                                        <p className="font-medium">{new Date(selectedApp.created_at).toLocaleString()}</p>
                                    </div>
                                </div>

                                {selectedApp.message && (
                                    <div>
                                        <label className="text-sm text-slate-500">{lang === 'ru' ? 'Сообщение' : 'Xabar'}</label>
                                        <p className="mt-1 p-3 bg-slate-50 rounded-lg">{selectedApp.message}</p>
                                    </div>
                                )}

                                {selectedApp.resumes && (
                                    <div className="border-t pt-4">
                                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            {lang === 'ru' ? 'Прикрепленное резюме' : 'Biriktirilgan rezyume'}
                                        </h4>
                                        <Card>
                                            <CardContent className="p-4">
                                                <p className="font-medium">{selectedApp.resumes.title}</p>
                                                {selectedApp.resumes.about && (
                                                    <p className="text-sm text-slate-600 mt-2">{selectedApp.resumes.about}</p>
                                                )}
                                                {selectedApp.resumes.skills && selectedApp.resumes.skills.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-3">
                                                        {selectedApp.resumes.skills.map((skill, i) => (
                                                            <Badge key={i} variant="secondary">{skill}</Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                        <div className="flex justify-end mt-2">
                                            <Button variant="outline" size="sm" asChild className="text-sky-600 border-sky-200 hover:bg-sky-50">
                                                <a href={`/resumes/${selectedApp.resumes.id}`} target="_blank" rel="noopener noreferrer">
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    {lang === 'ru' ? 'Посмотреть полностью' : 'To\'liq ko\'rish'}
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button variant="outline" onClick={() => setSelectedApp(null)}>
                                        {lang === 'ru' ? 'Закрыть' : 'Yopish'}
                                    </Button>
                                    <Button
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                            updateStatus(selectedApp.id, 'invited');
                                            setSelectedApp(null);
                                        }}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        {lang === 'ru' ? 'Пригласить' : 'Taklif qilish'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </ProfileLayout>
    );
}
