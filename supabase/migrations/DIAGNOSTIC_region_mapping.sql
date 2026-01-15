-- =====================================================
-- DIAGNOSTIC: Check why FK mapping fails
-- Run these queries in Supabase SQL Editor
-- =====================================================

-- 1. Check if region_name is even populated
SELECT 
    COUNT(*) as total_imported,
    COUNT(region_name) as with_region_name,
    COUNT(district_name) as with_district_name,
    COUNT(raw_source_json) as with_raw_json
FROM jobs 
WHERE is_imported = true;

-- 2. Show actual region_name values (top 10 unique)
SELECT DISTINCT region_name, COUNT(*) as cnt
FROM jobs 
WHERE is_imported = true AND region_name IS NOT NULL
GROUP BY region_name
ORDER BY cnt DESC
LIMIT 20;

-- 3. Show our regions table values
SELECT id, name_uz, name_ru, slug FROM regions ORDER BY id;

-- 4. Try to find ANY match between imported region_name and regions.name_uz
SELECT 
    j.region_name as job_region_name,
    r.name_uz as our_region_name,
    r.id as region_id
FROM jobs j
CROSS JOIN regions r
WHERE j.is_imported = true 
  AND j.region_name IS NOT NULL
  AND (
    LOWER(j.region_name) = LOWER(r.name_uz) 
    OR LOWER(j.region_name) = LOWER(r.name_ru)
  )
LIMIT 10;

-- 5. Check raw_source_json.filial structure for first imported job
SELECT 
    source_id,
    region_name,
    district_name,
    raw_source_json->'filial' as filial_json,
    raw_source_json->'filial'->'region' as filial_region,
    raw_source_json->'filial'->'city' as filial_city
FROM jobs 
WHERE is_imported = true 
  AND raw_source_json IS NOT NULL
LIMIT 3;

-- 6. Check if region_name contains different format than expected
SELECT 
    region_name,
    LENGTH(region_name) as len,
    -- Show hex to detect encoding issues
    encode(region_name::bytea, 'hex') as hex_value
FROM jobs 
WHERE is_imported = true AND region_name IS NOT NULL
LIMIT 5;

-- 7. Direct comparison test
SELECT 
    j.region_name,
    r.name_uz,
    j.region_name = r.name_uz as exact_match,
    LOWER(j.region_name) = LOWER(r.name_uz) as lowercase_match,
    j.region_name ILIKE r.name_uz as ilike_match
FROM jobs j, regions r
WHERE j.is_imported = true 
  AND j.region_name IS NOT NULL
LIMIT 50;
