import { getAuthClient } from "@/lib/auth/server";
import { supabase } from "@/lib/supabase";
import { loadHomeData } from "@/lib/home-data";
import { HeroSection } from "@/components/home/hero-section";
import { CategoriesSection } from "@/components/home/categories-section";
import { LatestJobsSection } from "@/components/home/latest-jobs-section";
import { SpecialCategoriesSection } from "@/components/home/special-categories-section";
import { HomeDataNotice } from "@/components/home/home-data-notice";
import { SeekersSection } from "@/components/home/seekers-section";
import { catalogFilters, searchResumes } from "@/lib/resume-catalog";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { loadHomeTotals } from "@/lib/home-totals";
import { loadHomeOverview } from "@/lib/home-overview-server";
import { HomeOverviewProvider } from "@/components/home/home-overview-provider";
export const revalidate = 60;

async function countHomeTotals() {
  try {
    return await loadHomeTotals(getAuthClient());
  } catch {
    return { totalUsers: null, archivedJobs: null };
  }
}

export default async function HomePage() {
  const [data, seekers, overview] = await Promise.all([
    loadHomeData(supabase, countHomeTotals),
    loadSeekers(),
    loadHomeOverview(),
  ]);
  return (
    <div className="home-canvas">
      <HeroSection regions={data.regions} stats={data.stats} />
      {data.unavailable && <HomeDataNotice />}
      <HomeOverviewProvider initial={overview}>
        <LatestJobsSection jobs={data.jobs} unavailable={data.unavailable} />
        <CategoriesSection categories={data.categories} jobCounts={overview?.categoryCounts || Object.fromEntries(data.categories.map(category => [category.id, null]))} />
        <SpecialCategoriesSection counts={overview?.specialCounts || { students: null, disabled: null, women: null }} />
        <SeekersSection resumes={seekers.resumes} unavailable={seekers.unavailable} />
        <HowItWorksSection />
      </HomeOverviewProvider>
    </div>
  );
}

async function loadSeekers() {
  try {
    const result = await searchResumes(
      getAuthClient(),
      catalogFilters(new URLSearchParams()),
      AbortSignal.timeout(15000),
    );
    return { resumes: result.resumes.slice(0, 4), unavailable: false };
  } catch {
    return { resumes: [], unavailable: true };
  }
}
