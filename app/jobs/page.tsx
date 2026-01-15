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


  const fetchJobs = useCallback(async () => {
    setLoading(true);

    // Build base query with count
    let query = supabase
      .from('jobs')
      .select('*, categories(*), districts(*, regions(*))', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });


    // Filter by Special Categories (Checkboxes)
    if (selectedSpecialCategories.length > 0) {
      if (selectedSpecialCategories.includes('students')) {
        query = query.eq('is_for_students', true);
      }
      if (selectedSpecialCategories.includes('graduates')) {
        query = query.eq('is_for_graduates', true);
      }
      if (selectedSpecialCategories.includes('disabled')) {
        query = query.eq('is_for_disabled', true);
      }
      if (selectedSpecialCategories.includes('women')) {
        query = query.eq('is_for_women', true);
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
      query = query.eq('experience', selectedExperience);
    }
    if (selectedEducation !== 'all') {
      query = query.eq('education_level', selectedEducation);
    }
    if (selectedGender !== 'all') {
      query = query.eq('gender', selectedGender);
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
  }, [selectedCategory, selectedDistrict, selectedRegion, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, searchQuery, page]);



  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name_uz');
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
    if (selectedGender !== 'all') params.set('gender', selectedGender);

    const newURL = params.toString() ? `/jobs?${params.toString()}` : '/jobs';
    router.push(newURL, { scroll: false });
  }, [searchQuery, selectedCategory, selectedRegion, selectedDistrict, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, router]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [updateURL]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedRegion, selectedDistrict, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, searchQuery]);

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
    setSearchQuery('');
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-indigo-900 text-white py-10 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl opacity-20"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-400 rounded-full blur-3xl opacity-20"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">{t.nav.jobs}</h1>
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.hero.searchPlaceholder}
                className="pl-12 h-14 bg-white text-slate-900 border-0 rounded-2xl shadow-xl shadow-indigo-900/20 text-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-120px)] overflow-y-auto pr-1 no-scrollbar">
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
