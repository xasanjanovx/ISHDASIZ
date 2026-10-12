'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useResumeCatalog } from '@/hooks/use-resume-catalog';
import { supabase } from '@/lib/supabase';
import { ResumeFilters } from '@/components/resumes/resume-filters';
import { ResumeCard } from '@/components/resumes/resume-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Category, Region } from '@/types/database';
import { Search, Loader2, Filter as SlidersHorizontal, X } from '@/components/ui/icons';
import { parseSalaryRange } from '@/lib/search-ranges';
import { AccountApiError } from '@/lib/account-api';
import { toast } from 'sonner';

type Filters = { q: string; category: string; region: string; district: string; experience: string; education: string; gender: string; salary: [number, number] };
const defaults: Filters = { q: '', category: 'all', region: 'all', district: 'all', experience: 'all', education: 'all', gender: 'all', salary: [0, 20000000] };
function readFilters(query: string): Filters {
    const params = new URLSearchParams(query);
    return { q: params.get('q') || '', category: params.get('category') || 'all', region: params.get('region') || 'all', district: params.get('district') || 'all',
        experience: params.get('experience') || 'all', education: params.get('education') || 'all', gender: params.get('gender') || 'all', salary: parseSalaryRange(params.get('salary')) };
}
function encodeFilters(filters: Filters) {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set('q', filters.q.trim());
    for (const key of ['category', 'region', 'district', 'experience', 'education', 'gender'] as const) if (filters[key] !== 'all') params.set(key, filters[key]);
    if (filters.salary[0] !== 0 || filters.salary[1] !== 20000000) params.set('salary', filters.salary.join('-'));
    return params.toString();
}
export function ResumeCatalog({basePath='/resumes'}:{basePath?:string}) {
    const { lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated } = useUserAuth();
    const { openModal } = useAuthModal();
    const isEmployer = Boolean(isAuthenticated && user?.active_role === 'employer');
    const urlQuery = searchParams.toString();
    const [localFilters, setLocalFilters] = useState(() => ({ base: urlQuery, value: readFilters(urlQuery) }));
    if (localFilters.base !== urlQuery) setLocalFilters({ base: urlQuery, value: readFilters(urlQuery) });
    // Back/Forward supplies current filters directly, without an effect race.
    const filters = localFilters.base === urlQuery ? localFilters.value : readFilters(urlQuery);
    const query = encodeFilters(filters);
    const catalog = useResumeCatalog(query);
    const [showFilters, setShowFilters] = useState(false);
    const [referenceRevision, setReferenceRevision] = useState(0);
    const [references, setReferences] = useState<{ categories: Category[]; regions: Region[]; error: boolean }>({ categories: [], regions: [], error: false });
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            supabase.from('categories').select('id,name_uz,name_ru').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz'),
            supabase.from('regions').select('id,name_uz,name_ru').order('name_uz'),
        ]).then(([categories, regions]) => {
            if (cancelled) return;
            if (categories.error || regions.error) throw new Error('Reference data unavailable');
            setReferences({ categories: categories.data as Category[] || [], regions: regions.data as Region[] || [], error: false });
        }).catch(() => { if (!cancelled) setReferences(previous => ({ ...previous, error: true })); });
        return () => { cancelled = true; };
    }, [referenceRevision]);
    useEffect(() => {
        if (localFilters.base !== urlQuery || query === urlQuery) return;
        const timer = setTimeout(() => router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false }), 400);
        return () => clearTimeout(timer);
    }, [query, urlQuery, localFilters.base, router, basePath]);
    const change = (patch: Partial<Filters>) => setLocalFilters({ base: urlQuery, value: { ...filters, ...patch } });
    const clear = () => setLocalFilters({ base: urlQuery, value: defaults });
    const hasActiveFilters = query !== '';
    const errorText = (error: unknown) => error instanceof AccountApiError && error.status === 400
        ? (lang === 'ru' ? 'Проверьте параметры поиска или сбросьте фильтры.' : 'Qidiruv parametrlarini tekshiring yoki filtrlarni tozalang.')
        : (lang === 'ru' ? 'Не удалось загрузить резюме. Попробуйте ещё раз.' : 'Rezyumelarni yuklab bo‘lmadi. Qayta urinib ko‘ring.');
    const requireEmployer = () => {
        toast.info(lang === 'ru' ? 'Чтобы открыть резюме, войдите как работодатель.' : 'Batafsil ko‘rish uchun ish beruvchi sifatida kiring.');
        openModal();
    };
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="border-b border-slate-200 bg-white py-10">
                <div className="container mx-auto px-4">
                    <p className="text-xs font-medium text-teal-700 uppercase tracking-widest mb-2">{lang === 'uz' ? 'Nomzodlar' : 'Кандидаты'}</p>
                    <h1 className="text-3xl md:text-4xl text-slate-950 font-semibold mb-2 tracking-tight">{lang === 'uz' ? 'Rezyumelar' : 'Резюме'}</h1>
                    <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full mb-6" />
                    <div className="flex gap-3 max-w-3xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input aria-label={lang === 'ru' ? 'Поиск резюме' : 'Rezyumelarni qidirish'} maxLength={150} value={filters.q}
                                onChange={event => change({ q: event.target.value })}
                                placeholder={lang === 'uz' ? 'Kasb yoki ko‘nikma bo‘yicha qidirish...' : 'Поиск по профессии или навыкам...'}
                                className="pl-12 h-12 bg-white border-slate-200 text-slate-900 rounded-xl placeholder:text-slate-400" />
                        </div>
                        <Button onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} aria-controls="resume-filters"
                            aria-label={lang === 'ru' ? (showFilters ? 'Закрыть фильтры' : 'Открыть фильтры') : (showFilters ? 'Filtrlarni yopish' : 'Filtrlarni ochish')}
                            className="h-12 px-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100">
                            {showFilters ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
                            <span className="ml-2 hidden sm:inline">{lang === 'uz' ? 'Filtrlar' : 'Фильтры'}</span>
                            {hasActiveFilters && <span className="ml-1.5 w-2 h-2 rounded-full bg-blue-400" />}
                        </Button>
                    </div>
                </div>
            </div>
            {showFilters && <div id="resume-filters" className="bg-white border-b border-slate-200 shadow-sm">
                <div className="container mx-auto px-4 py-5">
                    {references.error && <div role="alert" className="mb-4 flex flex-wrap gap-3 items-center text-red-700 text-sm">
                        {lang === 'ru' ? 'Не удалось загрузить справочники фильтров.' : 'Filtr ma’lumotlarini yuklab bo‘lmadi.'}
                        <Button variant="outline" onClick={() => setReferenceRevision(value => value + 1)}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button>
                    </div>}
                    <ResumeFilters categories={references.categories} regions={references.regions}
                        selectedCategory={filters.category} selectedRegion={filters.region} selectedDistrict={filters.district} salaryRange={filters.salary}
                        selectedExperience={filters.experience} selectedEducation={filters.education} selectedGender={filters.gender}
                        onCategoryChange={category => change({ category })} onRegionChange={region => change({ region, district: 'all' })}
                        onDistrictChange={district => change({ district })} onSalaryRangeChange={salary => change({ salary })}
                        onExperienceChange={experience => change({ experience })} onEducationChange={education => change({ education })}
                        onGenderChange={gender => change({ gender })} onClear={clear} />
                </div>
            </div>}
            <div className="container mx-auto px-4 py-8" aria-busy={catalog.loading || catalog.loadingMore}>
                {catalog.loading ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-slate-600">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />{lang === 'ru' ? 'Ищем резюме…' : 'Rezyumelar qidirilmoqda…'}
                </div> : catalog.error ? <div role="alert" className="text-center py-16 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-red-700 mb-6">{errorText(catalog.error)}</p>
                    <div className="flex justify-center flex-wrap gap-3">
                        <Button variant="outline" onClick={catalog.refresh}>{lang === 'uz' ? 'Qayta urinish' : 'Попробовать снова'}</Button>
                        {hasActiveFilters && <Button variant="outline" onClick={clear}>{lang === 'uz' ? 'Filtrlarni tozalash' : 'Сбросить фильтры'}</Button>}
                    </div>
                </div> : <>
                    {catalog.resumes.length === 0 ? <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                        <Search className="w-8 h-8 text-slate-400 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-slate-900">{catalog.nextCursor
                            ? (lang === 'ru' ? 'Пока нет совпадений' : 'Hozircha mos rezyume yo‘q')
                            : (lang === 'ru' ? 'Резюме не найдены' : 'Rezyumelar topilmadi')}</h2>
                        <p className="text-slate-500 mt-2 mb-6">{catalog.nextCursor
                            ? (lang === 'ru' ? 'Продолжите поиск, чтобы проверить остальные резюме.' : 'Qolgan rezyumelarni tekshirish uchun qidiruvni davom ettiring.')
                            : (lang === 'ru' ? 'Попробуйте изменить параметры поиска.' : 'Boshqa filtrlar bilan urinib ko‘ring.')}</p>
                        {!catalog.nextCursor && <Button variant="outline" onClick={clear}>{lang === 'uz' ? 'Filtrlarni tozalash' : 'Сбросить фильтры'}</Button>}
                    </div> : <>
                        <p className="text-sm text-slate-500 mb-4" role="status">{lang === 'ru' ? 'Показано резюме' : 'Ko‘rsatilgan rezyumelar'}: {catalog.resumes.length}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {catalog.resumes.map(resume => <ResumeCard key={resume.id} resume={resume} canOpenDetails={isEmployer} onRequireEmployerAccess={requireEmployer} />)}
                        </div>
                    </>}
                    {catalog.moreError && <p role="alert" className="text-center text-red-700 mt-6">{errorText(catalog.moreError)}</p>}
                    {catalog.nextCursor && <div className="flex justify-center mt-6">
                        <Button variant="outline" onClick={catalog.loadMore} disabled={catalog.loadingMore}>
                            {catalog.loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {catalog.moreError ? (lang === 'ru' ? 'Повторить загрузку' : 'Qayta yuklash')
                                : catalog.resumes.length ? (lang === 'ru' ? 'Загрузить ещё' : 'Yana yuklash') : (lang === 'ru' ? 'Продолжить поиск' : 'Qidiruvni davom ettirish')}
                        </Button>
                    </div>}
                </>}
            </div>
        </div>
    );
}
