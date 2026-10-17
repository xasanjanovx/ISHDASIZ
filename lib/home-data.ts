import type { SupabaseClient } from "@supabase/supabase-js";

type HomeCounts = {
  total: number;
  categories: Record<string, number>;
  special: { students: number; disabled: number; women: number };
};
export const HOME_JOB_FIELDS =
  "id,title_uz,title_ru,company_name,salary_min,salary_max,employment_type,created_at,region_name,categories(name_uz,name_ru,icon),districts(name_uz,name_ru,regions(name_uz,name_ru))";
type PlaceNames = { name_uz: string; name_ru: string };
export type HomeJob = {
  id: string;
  title_uz: string | null;
  title_ru: string | null;
  company_name: string | null;
  salary_min: number | null;
  salary_max: number | null;
  region_name?: string | null;
  categories?: (PlaceNames & { icon?: string }) | null;
  districts?: (PlaceNames & { regions?: PlaceNames | null }) | null;
};
const relation = (value: any) =>
  Array.isArray(value) ? value[0] || null : value || null;
function homeJob(row: any): HomeJob {
  const district = relation(row.districts);
  return {
    id: row.id,
    title_uz: row.title_uz,
    title_ru: row.title_ru,
    company_name: row.company_name,
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    region_name: row.region_name,
    categories: relation(row.categories),
    districts: district
      ? { ...district, regions: relation(district.regions) }
      : null,
  };
}
const validCount = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function parseHomeCounts(value: any): HomeCounts {
  if (
    !value ||
    !validCount(value.total) ||
    !value.categories ||
    typeof value.categories !== "object" ||
    Array.isArray(value.categories) ||
    !value.special
  )
    throw new Error("Home counts unavailable");
  let assigned = 0;
  for (const [id, n] of Object.entries(value.categories)) {
    if (
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ||
      !validCount(n) ||
      n > value.total
    )
      throw new Error("Home counts unavailable");
    assigned += n;
  }
  if (assigned > value.total || !Number.isSafeInteger(assigned))
    throw new Error("Home counts unavailable");
  for (const key of ["students", "disabled", "women"])
    if (!validCount(value.special[key]) || value.special[key] > value.total)
      throw new Error("Home counts unavailable");
  return {
    total: value.total,
    categories: value.categories,
    special: {
      students: value.special.students,
      disabled: value.special.disabled,
      women: value.special.women,
    },
  };
}

export async function loadHomeData(
  client: SupabaseClient,
  countTotals: () => PromiseLike<{ totalUsers: number | null; archivedJobs: number | null }>,
) {
  const fallback = {
    jobs: [],
    categories: [],
    regions: [],
    jobCounts: {} as Record<string, number | null>,
    specialCounts: { students: null, disabled: null, women: null },
    stats: { totalJobs: null, totalUsers: null, archivedJobs: null },
    unavailable: true,
  };
  try {
    const [jobs, categories, regions, totals, counts] = await Promise.all([
      client
        .from("jobs")
        .select(HOME_JOB_FIELDS)
        .eq("ishdasiz_job_available", true)
        .order("created_at", { ascending: false })
        .limit(6),
      client
        .from("categories")
        .select("*")
        .neq("id", "a0000011-0011-4000-8000-000000000011")
        .order("name_uz"),
      client.from("regions").select("id, name_uz, name_ru").order("name_uz"),
      countTotals(),
      client
        .rpc("ishdasiz_public_home_counts")
        .abortSignal(AbortSignal.timeout(15000)),
    ]);
    let aggregate: HomeCounts | null = null;
    if (!counts.error) {
      try {
        aggregate = parseHomeCounts(counts.data);
      } catch {
        /* Preserve unavailable counts instead of inventing zeroes. */
      }
    }
    const jobCounts: Record<string, number | null> = {};
    for (const category of categories.data || [])
      jobCounts[category.id] = aggregate
        ? aggregate.categories[category.id] || 0
        : null;
    return {
      jobs: (jobs.data || []).map(homeJob),
      categories: categories.data || [],
      regions: regions.data || [],
      jobCounts,
      specialCounts: aggregate?.special || fallback.specialCounts,
      stats: {
        totalJobs: aggregate?.total ?? null,
        totalUsers: validCount(totals.totalUsers) ? totals.totalUsers : null,
        archivedJobs: validCount(totals.archivedJobs) ? totals.archivedJobs : null,
      },
      unavailable: !!(
        jobs.error ||
        categories.error ||
        regions.error ||
        !aggregate
      ),
    };
  } catch {
    return fallback;
  }
}
