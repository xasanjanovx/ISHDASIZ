import { supabase } from '@/lib/supabase';
import { HeroSection } from '@/components/home/hero-section';
import { CategoriesSection } from '@/components/home/categories-section';
import { LatestJobsSection } from '@/components/home/latest-jobs-section';

export const revalidate = 0;

async function getHomeData() {
  const [jobsResult, categoriesResult, districtsResult] = await Promise.all([
    supabase
      .from('jobs_view')
      .select('*, categories(*), districts(*, regions(*))')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz'),
    supabase.from('districts').select('*').order('type', { ascending: false }),
  ]);

  const jobs = jobsResult.data || [];
  const categories = categoriesResult.data || [];
  const districts = districtsResult.data || [];

  // FIX: Count jobs per category from ALL jobs (paginated; Supabase defaults to 1000 rows)
  const allJobsForCounts: Array<{ category_id: string | null }> = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('jobs')
      .select('category_id')
      .eq('is_active', true)
      .range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    allJobsForCounts.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const jobCounts: Record<string, number> = {};
  (allJobsForCounts || []).forEach((job) => {
    if (job.category_id && job.category_id !== 'a0000011-0011-4000-8000-000000000011') {
      jobCounts[job.category_id] = (jobCounts[job.category_id] || 0) + 1;
    }
  });

  /* Special category counts */
  const specialCounts = {
    students: 0,
    disabled: 0,
    women: 0,
  };

  // Use separate count queries for accuracy
  const [studentsResult, disabledResult, womenResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('is_for_students.eq.true,is_for_graduates.eq.true'),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_for_disabled', true),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('is_for_women.eq.true,gender.eq.female,gender.eq.2,gender.eq.any,gender.eq.3,gender.is.null'),
  ]);

  specialCounts.students = studentsResult.count || 0;
  specialCounts.disabled = disabledResult.count || 0;
  specialCounts.women = womenResult.count || 0;

  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });

  return {
    jobs,
    categories,
    districts,
    jobCounts,
    specialCounts,
    stats: {
      totalJobs: totalJobs || 0,
      districts: districts.length,
      categories: categories.length,
    },
  };
}

import { SpecialCategoriesSection } from '@/components/home/special-categories-section';
import { StatsCards } from '@/components/home/stats-cards';
import { TelegramBanner } from '@/components/home/telegram-banner';

export default async function HomePage() {
  const { jobs, categories, jobCounts, specialCounts } = await getHomeData();

  return (
    <>
      <HeroSection />
      <LatestJobsSection jobs={jobs} />
      <SpecialCategoriesSection counts={specialCounts} />
      <TelegramBanner />
      <CategoriesSection categories={categories} jobCounts={jobCounts} />

      {/* <StatsCards /> removed as requested */}
    </>
  );
}
