'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { supabase } from '@/lib/supabase';
import { JobCard } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JobWithRelations, Category, District, Region } from '@/types/database';
import { Search, Grid3X3, List, MapIcon, Loader2 } from '@/components/ui/icons';
import Link from 'next/link';
import { expandExperienceFilterValues } from '@/lib/experience-compat';

export default function JobsPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<JobWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Pagination
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') || 'all');
  const [selectedDistrict, setSelectedDistrict] = useState(searchParams.get('district') || 'all');
  const [selectedSpecialCategories, setSelectedSpecialCategories] = useState<string[]>(
    searchParams.get('special') ? searchParams.get('special')!.split(',') : []
  );

  const initialSalary = searchParams.get('salary')
    ? searchParams.get('salary')!.split('-').map(Number) as [number, number]
    : [0, 20000000] as [number, number];

  const [salaryRange, setSalaryRange] = useState<[number, number]>(initialSalary);

  const [selectedEmploymentType, setSelectedEmploymentType] = useState(
    searchParams.get('type') || 'all'
  );

  const [selectedExperience, setSelectedExperience] = useState(
    searchParams.get('experience') || 'all'
  );

  const [selectedEducation, setSelectedEducation] = useState(
    searchParams.get('education') || 'all'
  );

  const [selectedGender, setSelectedGender] = useState(
    searchParams.get('gender') || 'all'
  );

  const [selectedPaymentType, setSelectedPaymentType] = useState(
    searchParams.get('payment_type') || 'all'
  );

  const [selectedWorkMode, setSelectedWorkMode] = useState(
    searchParams.get('work_mode') || 'all'
  );

  const [selectedWorkingDays, setSelectedWorkingDays] = useState(
    searchParams.get('working_days') || 'all'
  );

  const initialAge = searchParams.get('age')
    ? searchParams.get('age')!.split('-').map(Number) as [number | undefined, number | undefined]
    : [undefined, undefined] as [number | undefined, number | undefined];

  const [ageRange, setAgeRange] = useState<[number | undefined, number | undefined]>(initialAge);


  const fetchJobs = useCallback(async () => {
    setLoading(true);

    // Build base query with count
    let query = supabase
      .from('jobs')
      .select('*, categories(*), districts(*, regions(*))', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });


    const genderAnyClause = 'gender.eq.any,gender.eq.3,gender.is.null';
    const genderFemaleClause = `gender.eq.female,gender.eq.2,${genderAnyClause}`;
    const genderMaleClause = `gender.eq.male,gender.eq.1,${genderAnyClause}`;

    // Filter by Special Categories (Checkboxes)
    if (selectedSpecialCategories.length > 0) {
      if (selectedSpecialCategories.includes('students')) {
        query = query.or('is_for_students.eq.true,is_for_graduates.eq.true');
      }
      if (selectedSpecialCategories.includes('graduates')) {
        query = query.eq('is_for_graduates', true);
      }
      if (selectedSpecialCategories.includes('disabled')) {
        query = query.eq('is_for_disabled', true);
      }
      if (selectedSpecialCategories.includes('women')) {
        // "Ayollar uchun" should include women-specific and "Ahamiyatsiz"
        query = query.or(`is_for_women.eq.true,${genderFemaleClause}`);
      }
    }

    if (selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }
    if (selectedRegion !== 'all') {
      query = query.eq('region_id', selectedRegion);
    }
    if (selectedDistrict !== 'all') {
      query = query.eq('district_id', selectedDistrict);
    }
    if (selectedEmploymentType !== 'all') {
      query = query.eq('employment_type', selectedEmploymentType);
    }
    if (selectedExperience !== 'all') {
      const experienceValues = expandExperienceFilterValues(selectedExperience);
      query = experienceValues.length > 1
        ? query.in('experience', experienceValues)
        : query.eq('experience', selectedExperience);
    }
    if (selectedEducation !== 'all') {
      query = query.eq('education_level', selectedEducation);
    }
    if (selectedGender !== 'all') {
      const normalizedGender =
        selectedGender === '1' || selectedGender === 'male'
          ? 'male'
          : selectedGender === '2' || selectedGender === 'female'
            ? 'female'
            : selectedGender === '3' || selectedGender === 'any'
              ? 'any'
              : selectedGender;

      if (normalizedGender === 'male') {
        query = query.or(genderMaleClause);
      } else if (normalizedGender === 'female') {
        query = query.or(genderFemaleClause);
      } else if (normalizedGender === 'any') {
        query = query.or(genderAnyClause);
      } else {
        query = query.eq('gender', normalizedGender);
      }
    }
    if (selectedPaymentType !== 'all') {
      query = query.eq('payment_type', parseInt(selectedPaymentType));
    }
    if (selectedWorkMode !== 'all') {
      query = query.eq('work_mode', selectedWorkMode);
    }
    if (selectedWorkingDays !== 'all') {
      // working_days_id in DB is integer, but working_days is text?
      // Let's check scraper again... it maps to working_days_id string.
      // Actually `working_days_id` column exists in DB? Step 1816 says `working_days` (text) and `working_days_id` (integer) both exist?
      // Step 1816 output: `working_days` (text) exists. `working_days_id` NOT in list?
      // Let's re-read step 1816 carefully.
      // [{\"column_name\":\"working_days\",\"data_type\":\"text\"}] - NO working_days_id!
      // So we filter by `working_days` column which holds the ID as string based on scraper?
      // Scraper: `working_days: detail.working_days_id ? String(detail.working_days_id) : undefined`
      // Yes, so filter by `working_days` column using string value.
      query = query.eq('working_days', selectedWorkingDays);
    }

    // Age Filter
    if (ageRange[0]) {
      // age_min <= range[0] ?? No, usually user wants "Age X" -> fits in [age_min, age_max]
      // OR user inputs their age? "Yosh: 20 dan 30 gacha" usually means "Vacancies suitable for this age range".
      // Let's assume user is searching for jobs suitable for age X.
      // But UI is "Dan ... Gacha" (From ... To). This implies User Age Range?
      // If user says "18-25", do we find jobs that accept 18-25?
      // Logic: job.age_min <= filter.max AND job.age_max >= filter.min
      // If filter.min is set: job.age_max >= filter.min OR job.age_max is null
      query = query.or(`age_max.gte.${ageRange[0]},age_max.is.null`);
    }
    if (ageRange[1]) {
      // If filter.max is set: job.age_min <= filter.max OR job.age_min is null
      query = query.or(`age_min.lte.${ageRange[1]},age_min.is.null`);
    }


    // Filter by Salary
    if (salaryRange[0] > 0) {
      query = query.or(`salary_max.gte.${salaryRange[0]},salary_max.is.null`);
    }
    if (salaryRange[1] < 20000000) {
      query = query.or(`salary_min.lte.${salaryRange[1]},salary_min.is.null`);
    }

    // Search Query (Server-side)
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      query = query.or(`title_uz.ilike.%${q}%,title_ru.ilike.%${q}%,description_uz.ilike.%${q}%,description_ru.ilike.%${q}%,company_name.ilike.%${q}%`);
    }

    // Add pagination
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    console.log('Jobs query result:', data?.length, 'Total:', count, 'Error:', error);

    const filteredJobs = data || [];
    setJobs(filteredJobs);
    setTotalCount(count || 0);
    setLoading(false);
  }, [selectedCategory, selectedDistrict, selectedRegion, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, selectedPaymentType, selectedWorkMode, selectedWorkingDays, ageRange, searchQuery, page]);



  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz');
    setCategories(data || []);
  }, []);

  const fetchRegions = useCallback(async () => {
    const { data } = await supabase.from('regions').select('*').order('name_uz');
    setRegions(data || []);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchRegions();
  }, [fetchCategories, fetchRegions]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedRegion !== 'all') params.set('region', selectedRegion);
    if (selectedDistrict !== 'all') params.set('district', selectedDistrict);

    if (selectedSpecialCategories.length > 0) {
      params.set('special', selectedSpecialCategories.join(','));
    }

    if (salaryRange[0] > 0 || salaryRange[1] < 20000000) {
      params.set('salary', `${salaryRange[0]}-${salaryRange[1]}`);
    }

    if (selectedEmploymentType !== 'all') params.set('type', selectedEmploymentType);
    if (selectedExperience !== 'all') params.set('experience', selectedExperience);
    if (selectedEducation !== 'all') params.set('education', selectedEducation);
    if (selectedEducation !== 'all') params.set('education', selectedEducation);
    if (selectedGender !== 'all') params.set('gender', selectedGender);
    if (selectedPaymentType !== 'all') params.set('payment_type', selectedPaymentType);
    if (selectedWorkMode !== 'all') params.set('work_mode', selectedWorkMode);
    if (selectedWorkingDays !== 'all') params.set('working_days', selectedWorkingDays);
    if (ageRange[0] || ageRange[1]) params.set('age', `${ageRange[0] || ''}-${ageRange[1] || ''}`);

    const newURL = params.toString() ? `/jobs?${params.toString()}` : '/jobs';
    router.push(newURL, { scroll: false });
  }, [searchQuery, selectedCategory, selectedRegion, selectedDistrict, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, selectedPaymentType, selectedWorkMode, selectedWorkingDays, ageRange, router]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [updateURL]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedRegion, selectedDistrict, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, selectedPaymentType, selectedWorkMode, selectedWorkingDays, ageRange, searchQuery]);

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedRegion('all');
    setSelectedDistrict('all');
    setSelectedSpecialCategories([]);
    setSalaryRange([0, 20000000]);
    setSelectedEmploymentType('all');
    setSelectedExperience('all');
    setSelectedEducation('all');
    setSelectedGender('all');
    setSelectedPaymentType('all');
    setSelectedWorkMode('all');
    setSelectedWorkingDays('all');
    setAgeRange([undefined, undefined]);
    setSearchQuery('');
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative text-white py-10 overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 animate-mesh" style={{ backgroundSize: '200% 200%' }} />
        {/* Floating orbs */}
        <div className="absolute top-0 right-[15%] w-[250px] h-[250px] bg-blue-500/15 rounded-full blur-[80px] animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-teal-500/10 rounded-full blur-[60px] animate-float-medium pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <p className="text-xs font-medium text-blue-300/80 uppercase tracking-widest mb-2">
            {lang === 'uz' ? 'Vakansiyalar' : 'Вакансии'}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">{t.nav.jobs}</h1>
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full mb-6" />
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.hero.searchPlaceholder}
                className="pl-12 h-14 bg-white/5 backdrop-blur-sm border-white/10 text-white rounded-xl placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-blue-500/20 focus:bg-white/10 transition-all text-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 flex-shrink-0 lg:sticky lg:top-24 self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto pr-1 no-scrollbar">
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
              onCategoryChange={setSelectedCategory}
              onRegionChange={setSelectedRegion}
              onDistrictChange={setSelectedDistrict}
              onSpecialCategoriesChange={setSelectedSpecialCategories}
              onSalaryRangeChange={setSalaryRange}
              onEmploymentTypeChange={setSelectedEmploymentType}
              onExperienceChange={setSelectedExperience}
              onEducationChange={setSelectedEducation}
              onGenderChange={setSelectedGender}

              selectedPaymentType={selectedPaymentType}
              selectedWorkMode={selectedWorkMode}
              selectedWorkingDays={selectedWorkingDays}
              ageRange={ageRange}

              onPaymentTypeChange={setSelectedPaymentType}
              onWorkModeChange={setSelectedWorkMode}
              onWorkingDaysChange={setSelectedWorkingDays}
              onAgeRangeChange={setAgeRange}

              onClear={clearFilters}
            />

          </aside>

          <main className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">
                {lang === 'uz'
                  ? `${totalCount} ta vakansiya topildi`
                  : `Найдено ${totalCount} вакансий`}
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
                    onClick={() => setViewMode('list')}
                    className="rounded-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
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
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <p className="text-slate-500 mb-4">{t.job.noJobs}</p>
                <Button variant="outline" onClick={clearFilters}>
                  {t.filters.clear}
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
                    <JobCard key={job.id} job={job} />
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
          </main>
        </div>
      </div>
    </div>
  );
}
