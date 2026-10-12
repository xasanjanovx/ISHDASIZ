import { getAuthClient } from '@/lib/auth/server';
import { supabase } from '@/lib/supabase';
import { loadHomeData } from '@/lib/home-data';
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

export default async function HomePage() {
  const data = await loadHomeData(supabase, countPublicResumes);
  return <>
    <HeroSection regions={data.regions} jobs={data.jobs} stats={data.stats} />
    {data.unavailable && <HomeDataNotice />}
    <LatestJobsSection jobs={data.jobs} unavailable={data.unavailable} />
    <CategoriesSection categories={data.categories} jobCounts={data.jobCounts} />
    <SpecialCategoriesSection counts={data.specialCounts} />
    <TelegramBanner />
  </>;
}
