'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Briefcase, MapPin, Banknote, Loader2, Trash2 } from '@/components/ui/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatSalary } from '@/lib/constants';

interface FavoriteJob {
    id: string;
    job_id: string;
    created_at: string;
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

export default function FavoritesPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFavorites = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('favorites')
                    .select(`
                        id,
                        job_id,
                        created_at,
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
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setFavorites((data as any) || []);
            } catch (err) {
                console.error('Error fetching favorites:', err);
                toast.error(lang === 'ru' ? 'Ошибка загрузки' : 'Yuklashda xatolik');
            }
            setIsLoading(false);
        };

        fetchFavorites();
    }, [user?.id, lang]);

    const removeFavorite = async (favoriteId: string) => {
        try {
            const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('id', favoriteId);

            if (error) throw error;

            setFavorites(favorites.filter(f => f.id !== favoriteId));
            toast.success(lang === 'ru' ? 'Удалено из избранного' : 'Sevimlilardan o\'chirildi');
        } catch (err) {
            console.error('Error removing favorite:', err);
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
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Избранные вакансии' : 'Sevimli vakansiyalar'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Сохраненные вакансии' : 'Saqlangan vakansiyalar'}
                    </p>
                </div>

                {/* Empty state or list */}
                {favorites.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <Heart className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет избранных вакансий' : 'Sevimli vakansiyalar yo\'q'}
                            </h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Добавляйте вакансии в избранное, чтобы не потерять их'
                                    : 'Vakansiyalarni yo\'qotmaslik uchun sevimlilarga qo\'shing'}
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
                        {favorites.map((fav) => {
                            const job = fav.jobs;
                            if (!job) return null;

                            return (
                                <Card key={fav.id} className="hover:shadow-md transition-shadow">
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => removeFavorite(fav.id)}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </Button>
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
