import { supabase } from '@/lib/supabase';
import { AiAssistantWidget } from '@/components/home/ai-assistant-widget';
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
    supabase.from('categories').select('*').order('name_uz'),
    supabase.from('districts').select('*').order('type', { ascending: false }),
  ]);

  const jobs = jobsResult.data || [];
  const categories = categoriesResult.data || [];
  const districts = districtsResult.data || [];

  // FIX: Count jobs per category from ALL active jobs, not just the limited 6
  const { data: allJobsForCounts } = await supabase
    .from('jobs')
    .select('category_id')
    .eq('is_active', true);

  const jobCounts: Record<string, number> = {};
  (allJobsForCounts || []).forEach((job) => {
    if (job.category_id) {
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
      .eq('is_for_women', true),
  ]);

  specialCounts.students = studentsResult.count || 0;
  specialCounts.disabled = disabledResult.count || 0;
  specialCounts.women = womenResult.count || 0;

  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

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
      <AiAssistantWidget />
    </>
  );
}
