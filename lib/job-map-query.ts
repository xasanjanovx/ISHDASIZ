import type { SupabaseClient } from "@supabase/supabase-js";

// The map needs the public card projection plus a point, not full source payloads.
export const JOB_MAP_FIELDS =
  "id,title_uz,title_ru,company_name,salary_min,salary_max,employment_type,created_at,payment_type,work_mode,is_for_students,is_for_graduates,is_for_disabled,is_for_women,latitude,longitude,address,regions(name_uz,name_ru),districts(name_uz,name_ru),categories(id,name_uz,name_ru,icon)";
export const JOB_MAP_PAGE_SIZE = 50;
export function jobMapQuery(
  client: SupabaseClient,
  page: number,
  pageSize = JOB_MAP_PAGE_SIZE,
) {
  return client
    .from("jobs")
    .select(JOB_MAP_FIELDS, { count: "exact" })
    .eq("ishdasiz_job_available", true)
    .gte("latitude", -90)
    .lte("latitude", 90)
    .gte("longitude", -180)
    .lte("longitude", 180)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
}
