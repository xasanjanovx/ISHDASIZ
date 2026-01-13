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
  // const [districts, setDistricts] = useState<District[]>([]); // Moved to filter component
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

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

    let query = supabase
      .from('jobs')
      .select('*, categories(*), districts(*, regions(*))')
      .eq('is_active', true)
      .order('created_at', { ascending: false });


    // Filter by Special Categories (Checkboxes)
    if (selectedSpecialCategories.length > 0) {
      if (selectedSpecialCategories.includes('students')) {
        query = query.eq('is_for_students', true);
      }
      if (selectedSpecialCategories.includes('disabled')) {
        query = query.eq('is_for_disabled', true);
      }
      if (selectedSpecialCategories.includes('women')) {
        query = query.eq('is_for_women', true);
      }
    }

    if (selectedCategory !== 'all') {
      // NOTE: 'students', 'disabled', 'women' are no longer in selectedCategory (Category Select), they are in Special Categories
      // But we process category_id here for general categories
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
    // Filter by Salary
    if (salaryRange[0] > 0) {
      // Show jobs where the Maximum salary is at least the user's Minimum requirement
      // OR jobs where Maximum salary is not specified (Negotiable/Unlimited)
      query = query.or(`salary_max.gte.${salaryRange[0]},salary_max.is.null`);
    }
    if (salaryRange[1] < 20000000) {
      // Show jobs where the Minimum salary is at most the user's Maximum budget/expectation
      // OR jobs where Minimum salary is not specified
      query = query.or(`salary_min.lte.${salaryRange[1]},salary_min.is.null`);
    }

    const { data, error } = await query;
    console.log('Jobs query result:', data?.length, 'Error:', error);

    let filteredJobs = data || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredJobs = filteredJobs.filter(
        (job) =>
          job.title_uz?.toLowerCase().includes(q) ||
          job.title_ru?.toLowerCase().includes(q) ||
          job.description_uz?.toLowerCase().includes(q) ||
          job.description_ru?.toLowerCase().includes(q) ||
          job.company_name?.toLowerCase().includes(q)
      );
    }

    setJobs(filteredJobs);
    setLoading(false);
  }, [selectedCategory, selectedDistrict, selectedRegion, selectedSpecialCategories, salaryRange, selectedEmploymentType, selectedExperience, selectedEducation, selectedGender, searchQuery]);



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
  };


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 text-white relative z-10">{t.nav.jobs}</h1>
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.hero.searchPlaceholder}
                className="pl-10 h-12 bg-white text-slate-900 border-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 flex-shrink-0">
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
                  ? `${jobs.length} ta vakansiya topildi`
                  : `Найдено ${jobs.length} вакансий`}
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
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
