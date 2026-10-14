import { getAuthClient } from "@/lib/auth/server";
import { supabase } from "@/lib/supabase";
import { loadHomeData } from "@/lib/home-data";
import { HeroSection } from "@/components/home/hero-section";
import { CategoriesSection } from "@/components/home/categories-section";
import { LatestJobsSection } from "@/components/home/latest-jobs-section";
import { SpecialCategoriesSection } from "@/components/home/special-categories-section";
import { TelegramBanner } from "@/components/home/telegram-banner";
import { HomeDataNotice } from "@/components/home/home-data-notice";
import { SeekersSection } from "@/components/home/seekers-section";
import { catalogFilters, searchResumes } from "@/lib/resume-catalog";

export const revalidate = 60;

async function countPublicResumes() {
  try {
    return await getAuthClient()
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("ishdasiz_resume_available", true)
      .abortSignal(AbortSignal.timeout(15000));
  } catch {
    return { count: null, error: true };
  }
}

export default async function HomePage() {
  const [data, seekers] = await Promise.all([
    loadHomeData(supabase, countPublicResumes),
    loadSeekers(),
  ]);
  return (
    <div className="home-canvas">
      <HeroSection regions={data.regions} stats={data.stats} />
      {data.unavailable && <HomeDataNotice />}
      <LatestJobsSection jobs={data.jobs} unavailable={data.unavailable} />
      <CategoriesSection
        categories={data.categories}
        jobCounts={data.jobCounts}
      />
      <SeekersSection
        resumes={seekers.resumes}
        unavailable={seekers.unavailable}
      />
      <SpecialCategoriesSection counts={data.specialCounts} />
      <TelegramBanner />
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
