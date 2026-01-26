-- ============================================================================
-- JOB INTEGRITY DIAGNOSTIC SCRIPT
-- Run this in Supabase SQL Editor to verify data quality
-- ============================================================================

-- 1. Check for Active Jobs Missing Critical Relations
-- ----------------------------------------------------------------------------
-- Should be 0 rows for critical errors
SELECT 
  id, 
  title_uz, 
  source, 
  region_id, 
  district_id, 
  category_id
FROM jobs 
WHERE is_active = true 
  AND (region_id IS NULL OR category_id IS NULL);

-- 2. Check for Salary Logic Errors
-- ----------------------------------------------------------------------------
-- Should be 0 rows
SELECT id, title_uz, salary_min, salary_max 
FROM jobs 
WHERE salary_min > salary_max AND salary_max > 0;

-- 3. Check for Region/District Mismatches
-- ----------------------------------------------------------------------------
-- Jobs linked to a district that doesn't belong to the linked region
SELECT 
  j.id, 
  j.region_id as job_region, 
  d.region_id as district_region,
  r.name_uz as region_name,
  d.name_uz as district_name
FROM jobs j
JOIN districts d ON j.district_id = d.id
JOIN regions r ON j.region_id = r.id
WHERE j.region_id != d.region_id;

-- 4. Check Description Coverage
-- ----------------------------------------------------------------------------
-- Jobs active but with empty descriptions (excluding those with raw info fallback)
SELECT 
  COUNT(*) as total_active,
  COUNT(CASE WHEN (description_uz IS NULL OR description_uz = '') AND raw_source_json->>'info' IS NULL THEN 1 END) as truly_empty_desc
FROM jobs
WHERE is_active = true;

-- 5. Check Category Distribution
-- ----------------------------------------------------------------------------
-- Ensure no massive "Unknown" pile
SELECT 
  c.name_uz, 
  COUNT(*) as count 
FROM jobs j
LEFT JOIN categories c ON j.category_id = c.id
WHERE j.is_active = true
GROUP BY c.name_uz
ORDER BY count DESC;

-- 6. Check Import Status recent
-- ----------------------------------------------------------------------------
SELECT 
  source, 
  COUNT(*) as recent_jobs
FROM jobs
WHERE created_at > (NOW() - INTERVAL '24 hours')
GROUP BY source;
