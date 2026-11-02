import type { SupabaseClient } from "@supabase/supabase-js";

// The map needs the public card projection plus a point, not full source payloads.
export const JOB_MAP_FIELDS =
  "id,title_uz,title_ru,company_name,salary_min,salary_max,employment_type,created_at,payment_type,work_mode,is_for_students,is_for_graduates,is_for_disabled,is_for_women,latitude,longitude,address,regions(name_uz,name_ru),districts(name_uz,name_ru),categories(id,name_uz,name_ru,icon)";
export const JOB_MAP_PAGE_SIZE = 50;
export function jobMapQuery(
  client: SupabaseClient,
  page: number,
  pageSize = JOB_MAP_PAGE_SIZE,
  options: {count?: 'exact'|'none'|'only';lookAhead?:boolean} = {},
) {
  const query=client
    .from("jobs")
    .select(options.count==='only'?'id':JOB_MAP_FIELDS, { count: options.count==='none'?undefined:'exact' })
    .eq('is_active',true)
    .eq("ishdasiz_job_available", true)
    .gte("latitude", -90)
    .lte("latitude", 90)
    .gte("longitude", -180)
    .lte("longitude", 180);
  if(options.count==='only')return query.limit(0);
  return query.order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1+(options.lookAhead?1:0));
}
