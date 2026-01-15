-- =====================================================
-- BACKFILL: Update imported jobs with FK mapping
-- =====================================================
-- This migration updates existing imported jobs to set:
-- 1. region_id (FK to regions)
-- 2. district_id (FK to districts)
-- 3. experience/education_level string codes
-- 4. gender string codes
-- This enables filters, map, and statistics for imported jobs.

-- Step 1: Update region_id based on region_name
UPDATE jobs j
SET region_id = r.id
FROM regions r
WHERE j.is_imported = true
  AND j.region_id IS NULL
  AND j.region_name IS NOT NULL
  AND (
    -- Exact match
    j.region_name ILIKE r.name_uz
    OR j.region_name ILIKE r.name_ru
    -- Partial match (remove common suffixes for comparison)
    OR REPLACE(REPLACE(REPLACE(LOWER(j.region_name), 'viloyati', ''), 'viloyat', ''), 'область', '') 
       ILIKE '%' || REPLACE(REPLACE(REPLACE(LOWER(r.name_uz), 'viloyati', ''), 'viloyat', ''), 'shahri', '') || '%'
    -- Slug-based match
    OR LOWER(REPLACE(REPLACE(j.region_name, ' ', '-'), '''', '')) ILIKE '%' || r.slug || '%'
  );

-- Step 2: Update district_id based on district_name
UPDATE jobs j
SET district_id = d.id
FROM districts d
WHERE j.is_imported = true
  AND j.district_id IS NULL
  AND j.district_name IS NOT NULL
  AND (
    -- Exact match
    j.district_name ILIKE d.name_uz
    OR j.district_name ILIKE d.name_ru
    -- Partial match
    OR REPLACE(REPLACE(REPLACE(REPLACE(LOWER(j.district_name), 'tumani', ''), 'shahri', ''), 'район', ''), 'город', '')
       ILIKE '%' || REPLACE(REPLACE(REPLACE(REPLACE(LOWER(d.name_uz), 'tumani', ''), 'shahri', ''), 'район', ''), 'shahar', '') || '%'
  )
  -- Prefer matching within same region if region_id is set
  AND (d.region_id = j.region_id OR j.region_id IS NULL);

-- Step 3: Update experience string codes from raw_source_json
UPDATE jobs
SET experience = CASE 
    WHEN (raw_source_json->>'work_experiance')::int = 0 OR raw_source_json->>'work_experiance' IS NULL THEN 'no_experience'
    WHEN (raw_source_json->>'work_experiance')::int <= 1 THEN '1_3'
    WHEN (raw_source_json->>'work_experiance')::int <= 3 THEN '1_3'
    WHEN (raw_source_json->>'work_experiance')::int <= 6 THEN '3_6'
    ELSE '6_plus'
END
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND (experience IS NULL OR experience = '');

-- Step 4: Update education_level string codes
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
  AND (education_level IS NULL OR education_level = '');

-- Step 5: Update gender string codes
UPDATE jobs
SET gender = CASE 
    WHEN (raw_source_json->>'gender')::int = 1 THEN 'male'
    WHEN (raw_source_json->>'gender')::int = 2 THEN 'female'
    ELSE NULL
END
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND gender IS NULL;

-- Step 6: Update age_min/age_max from raw_source_json
UPDATE jobs
SET 
    age_min = COALESCE((raw_source_json->>'age_from')::int, age_min),
    age_max = COALESCE((raw_source_json->>'age_to')::int, age_max)
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND (age_min IS NULL OR age_max IS NULL);

-- Step 7: Ensure description is populated from raw_source_json.info if empty
UPDATE jobs
SET description_uz = raw_source_json->>'info',
    description_ru = raw_source_json->>'info'
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->>'info' IS NOT NULL
  AND (description_uz IS NULL OR description_uz = '');

-- Step 8: Update special category flags from for_whos array
UPDATE jobs
SET 
    is_for_disabled = COALESCE((raw_source_json->'for_whos')::jsonb ? '1', false) OR is_for_disabled,
    is_for_graduates = COALESCE((raw_source_json->'for_whos')::jsonb ? '2', false) OR is_for_graduates,
    is_for_students = COALESCE((raw_source_json->'for_whos')::jsonb ? '3', false) OR is_for_students
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->'for_whos' IS NOT NULL;

-- Step 9: Update lat/lng from raw_source_json.filial
UPDATE jobs
SET 
    latitude = COALESCE((raw_source_json->'filial'->>'lat')::float, latitude),
    longitude = COALESCE((raw_source_json->'filial'->>'long')::float, longitude)
WHERE is_imported = true
  AND raw_source_json IS NOT NULL
  AND raw_source_json->'filial' IS NOT NULL
  AND (latitude IS NULL OR longitude IS NULL);

-- =====================================================
-- VERIFICATION QUERIES (run these to check results)
-- =====================================================
-- SELECT 
--     COUNT(*) FILTER (WHERE is_imported = true) as total_imported,
--     COUNT(*) FILTER (WHERE is_imported = true AND region_id IS NOT NULL) as with_region_id,
--     COUNT(*) FILTER (WHERE is_imported = true AND district_id IS NOT NULL) as with_district_id,
--     COUNT(*) FILTER (WHERE is_imported = true AND experience IS NOT NULL) as with_experience,
--     COUNT(*) FILTER (WHERE is_imported = true AND education_level IS NOT NULL) as with_education,
--     COUNT(*) FILTER (WHERE is_imported = true AND latitude IS NOT NULL) as with_coordinates,
--     COUNT(*) FILTER (WHERE is_imported = true AND description_uz IS NOT NULL AND description_uz != '') as with_description
-- FROM jobs;
