'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    FileText, Plus, Eye, Edit3, Trash2, MoreVertical, Loader2, Users,
    MapPin, Building2, Clock, ChevronRight, Briefcase, CheckCircle, XCircle
} from '@/components/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatSalary, formatDate } from '@/lib/constants';

interface Vacancy {
    id: string;
    title_uz: string;
    title_ru: string;
    description_uz: string | null;
    description_ru: string | null;
    company_name: string | null;
    status: string;
    views_count: number;
    created_at: string;
    is_active: boolean;
    salary_min: number | null;
    salary_max: number | null;
    applications_count?: number;
    categories?: { name_uz: string; name_ru: string } | null;
    districts?: { name_uz: string; name_ru: string } | null;
    regions?: { name_uz: string; name_ru: string } | null;
}

export default function VacanciesPage() {
    const { lang, t } = useLanguage();
    const { user } = useUserAuth();
    const [vacancies, setVacancies] = useState<Vacancy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; id: string }>({ open: false, action: '', id: '' });

    useEffect(() => {
        const fetchVacancies = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                // First get employer_profile id
                const { data: profile, error: profileError } = await supabase
                    .from('employer_profiles')
                    .select('id, company_name, phone')
                    .eq('user_id', user.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    console.error('Profile fetch error:', profileError);
                }

                const rowsById = new Map<string, any>();
                const mergeRows = (rows: any[] | null | undefined) => {
                    for (const row of rows || []) {
                        if (!row?.id) continue;
                        rowsById.set(String(row.id), row);
                    }
                };

                const selectClause = `
                    id, title_uz, title_ru, description_uz, description_ru,
                    company_name, status, views_count, created_at, is_active,
                    salary_min, salary_max,
                    categories(name_uz, name_ru),
                    districts(name_uz, name_ru),
                    regions(name_uz, name_ru)
                `;

                const queryByEq = async (column: string, value: string) => {
                    const { data, error } = await supabase
                        .from('jobs')
                        .select(selectClause)
                        .eq(column, value)
                        .order('created_at', { ascending: false });
                    if (error) {
                        const msg = String(error.message || '').toLowerCase();
                        if (!(msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache'))) {
                            console.error(`Vacancies query error (${column}):`, error);
                        }
                        return;
                    }
                    mergeRows(data || []);
                };

                if (profile?.id) {
                    await queryByEq('employer_id', String(profile.id));
                }
                if (user?.id) {
                    await queryByEq('created_by', String(user.id));
                    await queryByEq('user_id', String(user.id));
                }

                const mergedVacancies = Array.from(rowsById.values())
                    .sort((a, b) => {
                        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
                        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
                        return bTime - aTime;
                    });

                if (mergedVacancies.length > 0) {
                    const jobIds = mergedVacancies.map(j => j.id);
                    const { data: appCounts } = await supabase
                        .from('job_applications')
                        .select('job_id')
                        .in('job_id', jobIds);

                    const countMap: Record<string, number> = {};
                    appCounts?.forEach(app => {
                        countMap[app.job_id] = (countMap[app.job_id] || 0) + 1;
                    });

                    setVacancies(mergedVacancies.map(v => ({
                        ...v,
                        applications_count: countMap[v.id] || 0,
                        categories: Array.isArray(v.categories) ? v.categories[0] : v.categories,
                        districts: Array.isArray(v.districts) ? v.districts[0] : v.districts,
                        regions: Array.isArray(v.regions) ? v.regions[0] : v.regions,
                    })) as Vacancy[]);
                }
            } catch (err) {
                console.error('Error fetching vacancies:', err);
                toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Yuklashda xatolik');
            }
            setIsLoading(false);
        };

        fetchVacancies();
    }, [user?.id, lang]);

    const handleDelete = async (vacancyId: string) => {
        try {
            const { error } = await supabase
                .from('jobs')
                .delete()
                .eq('id', vacancyId);

            if (error) throw error;

            setVacancies(vacancies.filter((v) => v.id !== vacancyId));
            toast.success(lang === 'ru' ? 'Вакансия удалена' : 'Vakansiya o\'chirildi');
        } catch (err) {
            console.error('Error deleting vacancy:', err);
            toast.error(lang === 'ru' ? 'Ошибка удаления' : 'O\'chirishda xatolik');
        }
        setConfirmDialog({ open: false, action: '', id: '' });
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('jobs')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            setVacancies(vacancies.map(v =>
                v.id === id ? { ...v, is_active: !currentStatus } : v
            ));
            toast.success(lang === 'ru' ? 'Статус обновлен' : 'Status yangilandi');
        } catch (err) {
            console.error('Error toggling status:', err);
            toast.error(lang === 'ru' ? 'Ошибка обновления' : 'Xatolik');
        }
    };

    const handleMarkFilled = async (id: string) => {
        try {
            const { error } = await supabase
                .from('jobs')
                .update({ status: 'filled', is_active: false })
                .eq('id', id);

            if (error) throw error;

            setVacancies(vacancies.map(v =>
                v.id === id ? { ...v, status: 'filled', is_active: false } : v
            ));
            toast.success(lang === 'ru' ? 'Вакансия закрыта - сотрудник найден!' : 'Vakansiya yopildi - xodim topildi!');
        } catch (err) {
            console.error('Error marking as filled:', err);
            toast.error(lang === 'ru' ? 'Ошибка' : 'Xatolik');
        }
        setConfirmDialog({ open: false, action: '', id: '' });
    };

    const handleReopen = async (id: string) => {
        try {
            const { error } = await supabase
                .from('jobs')
                .update({ status: 'active', is_active: true })
                .eq('id', id);

            if (error) throw error;

            setVacancies(vacancies.map(v =>
                v.id === id ? { ...v, status: 'active', is_active: true } : v
            ));
            toast.success(lang === 'ru' ? 'Вакансия открыта заново' : 'Vakansiya qayta ochildi');
        } catch (err) {
            console.error('Error reopening:', err);
            toast.error(lang === 'ru' ? 'Ошибка' : 'Xatolik');
        }
    };

    if (isLoading) {
        return (
            <ProfileLayout userType="employer" userName="Kompaniya">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="employer" userName="Kompaniya">
            {/* Confirm Dialog */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmDialog.action === 'delete'
                                ? (lang === 'ru' ? 'Удалить вакансию?' : 'Vakansiyani o\'chirmoqchimisiz?')
                                : (lang === 'ru' ? 'Закрыть вакансию?' : 'Vakansiyani yopmoqchimisiz?')
                            }
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.action === 'delete'
                                ? (lang === 'ru' ? 'Это действие нельзя отменить.' : 'Bu amalni bekor qilib bo\'lmaydi.')
                                : (lang === 'ru' ? 'Вакансия будет помечена как "Сотрудник найден" и скрыта от соискателей.' : 'Vakansiya "Xodim topildi" deb belgilanadi va nomzodlardan yashiriladi.')
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{lang === 'ru' ? 'Отмена' : 'Bekor qilish'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (confirmDialog.action === 'delete') handleDelete(confirmDialog.id);
                                else if (confirmDialog.action === 'filled') handleMarkFilled(confirmDialog.id);
                            }}
                            className={confirmDialog.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                        >
                            {confirmDialog.action === 'delete'
                                ? (lang === 'ru' ? 'Удалить' : 'O\'chirish')
                                : (lang === 'ru' ? 'Да, сотрудник найден' : 'Ha, xodim topildi')
                            }
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {lang === 'ru' ? 'Мои вакансии' : 'Mening vakansiyalarim'}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {lang === 'ru' ? 'Управляйте вакансиями компании' : 'Kompaniya vakansiyalarini boshqaring'}
                        </p>
                    </div>
                    <Button className="gap-2" asChild>
                        <Link href="/admin/jobs/new">
                            <Plus className="w-4 h-4" />
                            {lang === 'ru' ? 'Разместить вакансию' : 'Vakansiya joylash'}
                        </Link>
                    </Button>
                </div>

                {/* Empty state or list */}
                {vacancies.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <FileText className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет вакансий' : 'Vakansiyalar yo\'q'}
                            </h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Создайте первую вакансию, чтобы найти сотрудников'
                                    : 'Xodimlarni topish uchun birinchi vakansiyani yarating'}
                            </p>
                            <Button className="gap-2" asChild>
                                <Link href="/admin/jobs/new">
                                    <Plus className="w-4 h-4" />
                                    {lang === 'ru' ? 'Разместить вакансию' : 'Vakansiya joylash'}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {vacancies.map((vacancy) => {
                            const title = lang === 'ru' ? vacancy.title_ru : vacancy.title_uz;
                            const description = lang === 'ru' ? vacancy.description_ru : vacancy.description_uz;
                            const categoryName = vacancy.categories
                                ? lang === 'uz' ? vacancy.categories.name_uz : vacancy.categories.name_ru
                                : '';
                            const regionName = vacancy.regions
                                ? lang === 'uz' ? vacancy.regions.name_uz : vacancy.regions.name_ru
                                : '';
                            const districtName = vacancy.districts
                                ? lang === 'uz' ? vacancy.districts.name_uz : vacancy.districts.name_ru
                                : '';
                            const locationLabel = [regionName, districtName].filter(Boolean).join(', ');
                            const isFilled = vacancy.status === 'filled';

                            return (
                                <Card
                                    key={vacancy.id}
                                    className={`group relative hover:shadow-lg transition-all duration-300 overflow-hidden border-slate-200 ${isFilled ? 'bg-slate-50 border-emerald-200' : 'bg-white hover:border-sky-300'}`}
                                >
                                    <CardContent className="p-0">
                                        <div className="flex">
                                            <div className={`w-1.5 ${isFilled ? 'bg-emerald-500' : vacancy.is_active ? 'bg-gradient-to-b from-sky-500 to-sky-600' : 'bg-slate-300'}`} />
                                            <div className="flex-1 p-5">
                                                {/* Header Row */}
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${isFilled ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                                                            <Briefcase className="w-6 h-6" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="font-bold text-base text-slate-900 line-clamp-1 leading-tight">
                                                                    {title}
                                                                </h3>
                                                                {isFilled && (
                                                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                                        {lang === 'ru' ? 'Закрыта' : 'Yopildi'}
                                                                    </Badge>
                                                                )}
                                                                {!vacancy.is_active && !isFilled && (
                                                                    <Badge variant="outline" className="text-slate-500">
                                                                        {lang === 'ru' ? 'Скрыта' : 'Yashirin'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-slate-600 flex items-center gap-1.5">
                                                                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                                                                <span className="truncate">{vacancy.company_name || 'ISHDASIZ'}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {/* Salary Badge */}
                                                    <Badge className="hidden md:flex bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold px-3 whitespace-nowrap">
                                                        {formatSalary(vacancy.salary_min, vacancy.salary_max, lang)}
                                                    </Badge>
                                                </div>

                                                {/* Description */}
                                                {description && (
                                                    <p className="text-sm text-slate-600 line-clamp-2 mb-3 leading-relaxed">{description}</p>
                                                )}

                                                {/* Badges Row */}
                                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                                    {locationLabel && (
                                                        <Badge variant="outline" className="text-xs border-slate-300 text-slate-700">
                                                            <MapPin className="w-3 h-3 mr-1" />
                                                            {locationLabel}
                                                        </Badge>
                                                    )}
                                                    {categoryName && (
                                                        <Badge variant="outline" className="text-xs border-slate-300 text-slate-700">
                                                            {categoryName}
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Mobile Salary */}
                                                <Badge className="md:hidden bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold px-3 mb-4">
                                                    {formatSalary(vacancy.salary_min, vacancy.salary_max, lang)}
                                                </Badge>

                                                {/* Footer */}
                                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1.5">
                                                            <Eye className="w-3.5 h-3.5" />
                                                            {vacancy.views_count || 0}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <Users className="w-3.5 h-3.5" />
                                                            {vacancy.applications_count || 0} {lang === 'ru' ? 'откликов' : 'ariza'}
                                                        </span>
                                                        <span className="flex items-center gap-1.5 font-medium">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {formatDate(vacancy.created_at, lang)}
                                                        </span>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2">
                                                        {!isFilled && (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="hidden sm:flex text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 h-8"
                                                                    onClick={() => setConfirmDialog({ open: true, action: 'filled', id: vacancy.id })}
                                                                >
                                                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                                                    {lang === 'ru' ? 'Сотрудник найден' : 'Xodim topildi'}
                                                                </Button>

                                                                <div className="flex items-center gap-2 mr-2">
                                                                    <Switch
                                                                        checked={vacancy.is_active}
                                                                        onCheckedChange={() => handleToggleActive(vacancy.id, vacancy.is_active)}
                                                                    />
                                                                </div>
                                                            </>
                                                        )}

                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/jobs/${vacancy.id}`}>
                                                                        <Eye className="w-4 h-4 mr-2" />
                                                                        {lang === 'ru' ? 'Просмотр' : 'Ko\'rish'}
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/admin/jobs/${vacancy.id}`}>
                                                                        <Edit3 className="w-4 h-4 mr-2" />
                                                                        {lang === 'ru' ? 'Редактировать' : 'Tahrirlash'}
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {isFilled ? (
                                                                    <DropdownMenuItem onClick={() => handleReopen(vacancy.id)}>
                                                                        <ChevronRight className="w-4 h-4 mr-2" />
                                                                        {lang === 'ru' ? 'Открыть заново' : 'Qayta ochish'}
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem
                                                                        onClick={() => setConfirmDialog({ open: true, action: 'filled', id: vacancy.id })}
                                                                        className="text-emerald-600 sm:hidden"
                                                                    >
                                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                                        {lang === 'ru' ? 'Сотрудник найден' : 'Xodim topildi'}
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem
                                                                    className="text-red-600"
                                                                    onClick={() => setConfirmDialog({ open: true, action: 'delete', id: vacancy.id })}
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    {lang === 'ru' ? 'Удалить' : 'O\'chirish'}
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
