-- Cover public aggregate fields so counts need not read the large vacancy heap.
BEGIN;
CREATE INDEX IF NOT EXISTS ishdasiz_public_catalog_counts_idx
 ON public.jobs(region_id,district_id,category_id)
 INCLUDE(id,employer_id,user_id,created_by,is_active,status,source_status,views_count,employment_type,is_for_students,is_for_graduates,is_for_disabled,is_for_women,gender)
 WHERE is_active IS TRUE AND (status IS NULL OR status IN ('active','published','open'))
  AND COALESCE(source_status,'') NOT IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed');
COMMIT;
