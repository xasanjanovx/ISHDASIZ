'use client';

import { Suspense, useState, useEffect } from 'react';
import { PageLoading } from '@/components/layout/page-loading';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { supabase } from '@/lib/supabase';
import { JobCard } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Category, Region } from '@/types/database';
import { Search, Grid3X3, List, MapIcon, Loader2, Filter } from '@/components/ui/icons';
import Link from 'next/link';
import { readJobFilters, encodeJobFilters, JOB_PAGE_SIZE, type JobFiltersState } from '@/lib/job-catalog';
import { useJobCatalog } from '@/hooks/use-job-catalog';

export default function JobsPage() {
  return <Suspense fallback={<PageLoading />}><JobsContent /></Suspense>;
}

function JobsContent() {
  const { lang, t } = useLanguage();
  const router = useRouter(), searchParams = useSearchParams(), urlQuery = searchParams.toString();
  const [local, setLocal] = useState(() => ({ base: urlQuery, value: readJobFilters(urlQuery), writes: [] as string[] }));
  const ownWrite = local.writes.indexOf(urlQuery);
  if (local.base !== urlQuery) setLocal({ base: urlQuery, value: ownWrite >= 0 ? local.value : readJobFilters(urlQuery), writes: ownWrite >= 0 ? local.writes.slice(ownWrite + 1) : [] });
  const filters = local.base === urlQuery || ownWrite >= 0 ? local.value : readJobFilters(urlQuery);
  const query = encodeJobFilters(filters), catalog = useJobCatalog(query);
  const { jobs, totalCount, loading, loadError } = catalog;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (local.base !== urlQuery || query === urlQuery) return;
    const timer = setTimeout(() => {
      setLocal(previous => ({ ...previous, writes: [...previous.writes, query].slice(-8) }));
      router.replace(query ? '/jobs?' + query : '/jobs', { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, urlQuery, local.base, router]);
  const change = (patch: Partial<JobFiltersState>) => setLocal(previous => ({ ...previous, value: { ...previous.value, ...patch, page: 1 } }));
  const setPage = (value: number | ((current: number) => number)) => setLocal(previous => ({ ...previous, value: { ...previous.value, page: typeof value === 'function' ? value(previous.value.page) : value } }));
  const clearFilters = () => change(readJobFilters(''));
  const { q: searchQuery, category: selectedCategory, region: selectedRegion, district: selectedDistrict, special: selectedSpecialCategories,
    salary: salaryRange, type: selectedEmploymentType, experience: selectedExperience, education: selectedEducation, gender: selectedGender,
    payment_type: selectedPaymentType, work_mode: selectedWorkMode, working_days: selectedWorkingDays, age: ageRange, page } = filters;
  const totalPages = Math.ceil((totalCount || 0) / JOB_PAGE_SIZE);
  const [referenceRevision, setReferenceRevision] = useState(0);
  const [references, setReferences] = useState<{ categories: Category[]; regions: Region[]; error: boolean }>({ categories: [], regions: [], error: false });
  const { categories, regions } = references;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      supabase.from('categories').select('id,name_uz,name_ru,icon').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz').abortSignal(controller.signal),
      supabase.from('regions').select('id,name_uz,name_ru').order('name_uz').abortSignal(controller.signal),
    ]).then(([categories, regions]) => {
      if (cancelled) return;
      if (categories.error || regions.error) throw new Error('Reference data unavailable');
      setReferences({ categories: categories.data as Category[] || [], regions: regions.data as Region[] || [], error: false });
    }).catch(() => { if (!cancelled) setReferences(previous => ({ ...previous, error: true })); });
    return () => { cancelled = true; controller.abort(); };
  }, [referenceRevision]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative border-b border-slate-200 bg-white py-10 overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-white to-blue-50/50" />
        {/* Floating orbs */}
        <div className="absolute top-0 right-[15%] w-[250px] h-[250px] bg-blue-500/15 rounded-full blur-[80px] animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-teal-500/10 rounded-full blur-[60px] animate-float-medium pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-2">
            {lang === 'uz' ? 'Butun O‘zbekiston bo‘ylab' : 'По всему Узбекистану'}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-950 mb-2 tracking-tight">{t.nav.jobs}</h1>
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full mb-6" />
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
              <Input
                type="text"
                value={searchQuery}
                maxLength={150}
                onChange={(e) => change({ q: e.target.value })}
                placeholder={t.hero.searchPlaceholder}
                aria-label={lang === 'ru' ? 'Поиск вакансий' : 'Vakansiyalarni qidirish'}
                className="pl-12 h-14 bg-white border-slate-200 text-slate-900 rounded-xl placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 transition-all text-base"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <Button variant="outline" className="w-full justify-start gap-2 lg:hidden" aria-controls="job-catalog-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Filter className="size-4" />{filtersOpen ? (lang === 'ru' ? 'Скрыть фильтры' : 'Filtrlarni yashirish') : (lang === 'ru' ? 'Показать фильтры' : 'Filtrlarni ko‘rsatish')}</Button>
          <aside id="job-catalog-filters" className={`${filtersOpen ? 'block' : 'hidden'} w-full lg:block lg:w-72 shrink-0 lg:sticky lg:top-24 self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto pr-1 no-scrollbar`}>
            {references.error && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{lang === 'ru' ? 'Не удалось загрузить справочники фильтров.' : 'Filtr ma’lumotlarini yuklab bo‘lmadi.'}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setReferenceRevision(value => value + 1)}>{lang === 'ru' ? 'Повторить загрузку фильтров' : 'Filtrlarni qayta yuklash'}</Button></div>}
            <JobFilters
              categories={categories}
              regions={regions}
              selectedCategory={selectedCategory}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
              selectedSpecialCategories={selectedSpecialCategories}
              salaryRange={salaryRange}
              selectedEmploymentType={selectedEmploymentType}
              selectedExperience={selectedExperience}
              selectedEducation={selectedEducation}
              selectedGender={selectedGender}
              onCategoryChange={category => change({ category })}
              onRegionChange={region => change({ region, district: 'all' })}
              onDistrictChange={district => change({ district })}
              onSpecialCategoriesChange={special => change({ special })}
              onSalaryRangeChange={salary => change({ salary })}
              onEmploymentTypeChange={type => change({ type })}
              onExperienceChange={experience => change({ experience })}
              onEducationChange={education => change({ education })}
              onGenderChange={gender => change({ gender })}

              selectedPaymentType={selectedPaymentType}
              selectedWorkMode={selectedWorkMode}
              selectedWorkingDays={selectedWorkingDays}
              ageRange={ageRange}

              onPaymentTypeChange={payment_type => change({ payment_type })}
              onWorkModeChange={work_mode => change({ work_mode })}
              onWorkingDaysChange={working_days => change({ working_days })}
              onAgeRangeChange={age => change({ age })}

              onClear={clearFilters}
            />

          </aside>

          <section className="min-w-0 flex-1" aria-label={lang === 'ru' ? 'Результаты поиска' : 'Qidiruv natijalari'}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">
                {loading ? (lang === 'ru' ? 'Загрузка вакансий…' : 'Vakansiyalar yuklanmoqda…') : loadError ? (lang === 'ru' ? 'Данные временно недоступны' : 'Ma’lumotlar vaqtincha mavjud emas') : lang === 'uz' ? `${totalCount} ta vakansiya topildi` : `Найдено ${totalCount} вакансий`}
              </p>
              <div className="flex items-center gap-2">
                <Link href="/map">
                  <Button variant="outline" size="sm">
                    <MapIcon className="w-4 h-4 mr-2" />
                    {t.nav.map}
                  </Button>
                </Link>
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    aria-label={lang === 'ru' ? 'Показать списком' : 'Ro‘yxat ko‘rinishi'}
                    onClick={() => setViewMode('list')}
                    className="rounded-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    aria-label={lang === 'ru' ? 'Показать сеткой' : 'Katak ko‘rinishi'}
                    onClick={() => setViewMode('grid')}
                    className="rounded-none"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
              </div>
            ) : loadError ? (
              <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                <p className="mb-4 text-sm text-amber-900">{lang === 'ru' ? 'Не удалось загрузить вакансии. Проверьте соединение и повторите попытку.' : 'Vakansiyalarni yuklab bo‘lmadi. Internetni tekshiring va qayta urinib ko‘ring.'}</p>
                <Button variant="outline" onClick={catalog.refresh}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <p className="text-slate-500 mb-4">{t.job.noJobs}</p>
                <Button variant="outline" onClick={page > 1 ? () => setPage(1) : clearFilters}>
                  {page > 1 ? (lang === 'ru' ? 'Первая страница' : 'Birinchi sahifa') : t.filters.clear}
                </Button>
              </div>
            ) : (
              <>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid md:grid-cols-2 gap-4'
                      : 'flex flex-col gap-4'
                  }
                >
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} compact={viewMode === 'grid'} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      {lang === 'uz' ? 'Oldingi' : 'Назад'}
                    </Button>
                    <span className="text-sm text-slate-600 px-4">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      {lang === 'uz' ? 'Keyingi' : 'Далее'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
