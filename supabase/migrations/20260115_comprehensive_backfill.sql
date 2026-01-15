-- =====================================================
-- COMPREHENSIVE BACKFILL FOR IMPORTED JOBS
-- Run this in Supabase SQL Editor
-- =====================================================
-- This migration updates existing imported jobs to populate
-- all required fields from raw_source_json (if available)
-- and performs FK lookups for regions/districts.

-- STEP 1: Check current state (diagnostic)
-- SELECT 
--     COUNT(*) as total_imported,
--     COUNT(region_id) as with_region_id,
--     COUNT(district_id) as with_district_id,
--     COUNT(region_name) as with_region_name,
--     COUNT(raw_source_json) as with_raw_json
-- FROM jobs WHERE is_imported = true;

-- STEP 2: Update region_id from region_name (fuzzy match)
-- Using multiple matching strategies
UPDATE jobs j
SET region_id = (
    SELECT r.id FROM regions r
    WHERE 
        -- Exact match
        LOWER(TRIM(j.region_name)) = LOWER(TRIM(r.name_uz))
        OR LOWER(TRIM(j.region_name)) = LOWER(TRIM(r.name_ru))
        -- Partial match (core name without suffix)
        OR LOWER(REPLACE(REPLACE(REPLACE(TRIM(j.region_name), 'viloyati', ''), 'viloyat', ''), 'shahri', ''))
           = LOWER(REPLACE(REPLACE(REPLACE(TRIM(r.name_uz), 'viloyati', ''), 'viloyat', ''), 'shahri', ''))
        -- Contains match
        OR LOWER(r.name_uz) LIKE '%' || LOWER(TRIM(REPLACE(REPLACE(j.region_name, 'viloyati', ''), 'viloyat', ''))) || '%'
    LIMIT 1
)
WHERE j.is_imported = true 
  AND j.region_id IS NULL 
  AND j.region_name IS NOT NULL
  AND j.region_name != '';

-- STEP 3: Update district_id from district_name (fuzzy match)
UPDATE jobs j
SET district_id = (
    SELECT d.id FROM districts d
    WHERE 
        (LOWER(TRIM(j.district_name)) = LOWER(TRIM(d.name_uz))
         OR LOWER(TRIM(j.district_name)) = LOWER(TRIM(d.name_ru))
         OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(j.district_name), 'tumani', ''), 'tuman', ''), 'shahri', ''), 'shahar', ''))
            = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(d.name_uz), 'tumani', ''), 'tuman', ''), 'shahri', ''), 'shahar', ''))
        )
        AND (d.region_id = j.region_id OR j.region_id IS NULL)
    LIMIT 1
)
WHERE j.is_imported = true 
  AND j.district_id IS NULL 
  AND j.district_name IS NOT NULL
  AND j.district_name != '';

-- STEP 4: Update experience from raw_source_json.work_experiance
UPDATE jobs
SET experience = CASE 
    WHEN (raw_source_json->>'work_experiance')::int IS NULL OR (raw_source_json->>'work_experiance')::int = 0 THEN 'no_experience'
    WHEN (raw_source_json->>'work_experiance')::int <= 1 THEN '1_3'
    WHEN (raw_source_json->>'work_experiance')::int <= 3 THEN '1_3'
    WHEN (raw_source_json->>'work_experiance')::int <= 6 THEN '3_6'
    ELSE '6_plus'
END
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->>'work_experiance' IS NOT NULL
  AND (experience IS NULL OR experience = '');

-- STEP 5: Update education_level from raw_source_json.min_education
UPDATE jobs
SET education_level = CASE 
    WHEN (raw_source_json->>'min_education')::int IS NULL THEN 'any'
    WHEN (raw_source_json->>'min_education')::int = 1 THEN 'secondary'
    WHEN (raw_source_json->>'min_education')::int = 2 THEN 'vocational'
    WHEN (raw_source_json->>'min_education')::int >= 3 THEN 'higher'
    ELSE 'any'
END
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->>'min_education' IS NOT NULL
  AND (education_level IS NULL OR education_level = '');

-- STEP 6: Update gender from raw_source_json.gender
UPDATE jobs
SET gender = CASE 
    WHEN (raw_source_json->>'gender')::int = 1 THEN 'male'
    WHEN (raw_source_json->>'gender')::int = 2 THEN 'female'
    ELSE NULL
END
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->>'gender' IS NOT NULL
  AND gender IS NULL;

-- STEP 7: Update age_min/age_max
UPDATE jobs
SET 
    age_min = COALESCE((raw_source_json->>'age_from')::int, age_min),
    age_max = COALESCE((raw_source_json->>'age_to')::int, age_max)
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND (age_min IS NULL OR age_max IS NULL);

-- STEP 8: Update description from raw_source_json.info
UPDATE jobs
SET description_uz = COALESCE(raw_source_json->>'info', description_uz),
    description_ru = COALESCE(raw_source_json->>'info', description_ru)
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->>'info' IS NOT NULL
  AND (description_uz IS NULL OR description_uz = '');

-- STEP 9: Update special category flags
UPDATE jobs
SET 
    is_for_disabled = COALESCE(
        (raw_source_json->'for_whos' @> '[1]'::jsonb),
        is_for_disabled,
        false
    ),
    is_for_graduates = COALESCE(
        (raw_source_json->'for_whos' @> '[2]'::jsonb),
        is_for_graduates,
        false
    ),
    is_for_students = COALESCE(
        (raw_source_json->'for_whos' @> '[3]'::jsonb),
        is_for_students,
        false
    )
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->'for_whos' IS NOT NULL;

-- STEP 10: Update coordinates from raw_source_json.filial
UPDATE jobs
SET 
    latitude = COALESCE((raw_source_json->'filial'->>'lat')::float, latitude),
    longitude = COALESCE((raw_source_json->'filial'->>'long')::float, longitude)
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->'filial' IS NOT NULL
  AND (latitude IS NULL OR longitude IS NULL);

-- STEP 11: Update views_count and vacancy_count
UPDATE jobs
SET 
    views_count = COALESCE((raw_source_json->>'views_count')::int, views_count, 0),
    vacancy_count = COALESCE((raw_source_json->>'count')::int, vacancy_count, 1)
WHERE is_imported = true
  AND raw_source_json IS NOT NULL;

-- =====================================================
-- VERIFICATION: Run this after to check results
-- =====================================================
SELECT 
    COUNT(*) FILTER (WHERE is_imported = true) as total_imported,
    COUNT(*) FILTER (WHERE is_imported = true AND region_id IS NOT NULL) as with_region_id,
    COUNT(*) FILTER (WHERE is_imported = true AND district_id IS NOT NULL) as with_district_id,
    COUNT(*) FILTER (WHERE is_imported = true AND experience IS NOT NULL AND experience != '') as with_experience,
    COUNT(*) FILTER (WHERE is_imported = true AND education_level IS NOT NULL) as with_education,
    COUNT(*) FILTER (WHERE is_imported = true AND description_uz IS NOT NULL AND description_uz != '') as with_description,
    COUNT(*) FILTER (WHERE is_imported = true AND latitude IS NOT NULL) as with_coordinates
FROM jobs;
