import { getAuthClient } from '@/lib/auth/server';
import { supabase } from '@/lib/supabase';
import { HeroSection } from '@/components/home/hero-section';
import { CategoriesSection } from '@/components/home/categories-section';
import { LatestJobsSection } from '@/components/home/latest-jobs-section';
import { SpecialCategoriesSection } from '@/components/home/special-categories-section';
import { TelegramBanner } from '@/components/home/telegram-banner';
import { HomeDataNotice } from '@/components/home/home-data-notice';

export const revalidate = 60;

async function countPublicResumes() {
  try { return await getAuthClient().from('resumes').select('id', { count: 'exact', head: true }).eq('ishdasiz_resume_available', true).abortSignal(AbortSignal.timeout(15000)); }
  catch { return { count: null, error: true }; }
}

async function getHomeData() {
  const fallback = { jobs: [], categories: [], regions: [], jobCounts: {}, specialCounts: { students: null, disabled: null, women: null },
    stats: { totalJobs: null, totalResumes: null, totalEmployers: null }, unavailable: true };
  try {
    const [jobs, categories, regions, resumes, employers, students, disabled, women] = await Promise.all([
      supabase.from('jobs').select('*, categories(*), districts(*, regions(*))', { count: 'exact' }).eq('ishdasiz_job_available', true).order('created_at', { ascending: false }).limit(6),
      supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz'),
      supabase.from('regions').select('id, name_uz, name_ru').order('name_uz'),
      countPublicResumes(),
      supabase.from('employer_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('ishdasiz_job_available', true).or('is_for_students.eq.true,is_for_graduates.eq.true'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('ishdasiz_job_available', true).eq('is_for_disabled', true),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('ishdasiz_job_available', true).or('is_for_women.eq.true,gender.eq.female,gender.eq.2,gender.eq.any,gender.eq.3,gender.is.null'),
    ]);
    const jobCounts: Record<string, number | null> = {};
    if (!categories.error) {
      const counts = await Promise.all((categories.data || []).map(async category => {
        const result = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('ishdasiz_job_available', true).eq('category_id', category.id);
        return { id: category.id, count: result.error ? null : result.count };
      }));
      for (const result of counts) jobCounts[result.id] = result.count;
    }
    return { jobs: jobs.data || [], categories: categories.data || [], regions: regions.data || [], jobCounts,
      specialCounts: { students: students.error ? null : students.count, disabled: disabled.error ? null : disabled.count, women: women.error ? null : women.count },
      stats: { totalJobs: jobs.error ? null : jobs.count, totalResumes: resumes.error ? null : resumes.count, totalEmployers: employers.error ? null : employers.count },
      unavailable: !!(jobs.error || categories.error || regions.error),
    };
  } catch (error) {
    console.error('Home data unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return fallback;
  }
}

export default async function HomePage() {
  const data = await getHomeData();
  return <>
    <HeroSection regions={data.regions} jobs={data.jobs} stats={data.stats} />
    {data.unavailable && <HomeDataNotice />}
    <LatestJobsSection jobs={data.jobs} unavailable={data.unavailable} />
    <CategoriesSection categories={data.categories} jobCounts={data.jobCounts} />
    <SpecialCategoriesSection counts={data.specialCounts} />
    <TelegramBanner />
  </>;
}
