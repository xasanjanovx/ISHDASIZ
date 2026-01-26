-- COMPREHENSIVE FIX: Populate region_name and district_name from raw_source_json
-- This ensures job cards display correct location even if region_id/district_id are NULL

-- ==================== STEP 1: Update region_name from raw_source_json ====================
UPDATE jobs
SET region_name = raw_source_json->'filial'->'region'->>'name_uz'
WHERE source = 'osonish'
  AND raw_source_json IS NOT NULL
  AND raw_source_json->'filial'->'region'->>'name_uz' IS NOT NULL
  AND (region_name IS NULL OR region_name = '');

-- ==================== STEP 2: Update district_name from raw_source_json ====================
UPDATE jobs
SET district_name = raw_source_json->'filial'->'city'->>'name_uz'
WHERE source = 'osonish'
  AND raw_source_json IS NOT NULL
  AND raw_source_json->'filial'->'city'->>'name_uz' IS NOT NULL
  AND (district_name IS NULL OR district_name = '');

-- ==================== STEP 3: Map region_id by matching region name ====================
UPDATE jobs j
SET region_id = r.id
FROM regions r
WHERE j.source = 'osonish'
  AND j.region_name IS NOT NULL
  AND (
    LOWER(TRIM(r.name_uz)) = LOWER(TRIM(j.region_name))
    OR LOWER(TRIM(r.name_uz)) LIKE '%' || LOWER(TRIM(REPLACE(REPLACE(j.region_name, ' viloyati', ''), ' shahri', ''))) || '%'
  )
  AND (j.region_id IS NULL OR j.region_id != r.id);

-- ==================== STEP 4: Map Toshkent city specially ====================
UPDATE jobs
SET region_id = (SELECT id FROM regions WHERE LOWER(name_uz) LIKE '%toshkent%' LIMIT 1)
WHERE source = 'osonish'
  AND region_id IS NULL
  AND region_name IS NOT NULL
  AND (LOWER(region_name) LIKE '%toshkent%' OR LOWER(region_name) LIKE '%ташкент%');

-- ==================== STEP 5: Map district_id within correct region ====================
UPDATE jobs j
SET district_id = d.id
FROM districts d
WHERE j.source = 'osonish'
  AND j.region_id IS NOT NULL
  AND j.district_name IS NOT NULL
  AND d.region_id = j.region_id
  AND (
    LOWER(TRIM(d.name_uz)) = LOWER(TRIM(j.district_name))
    OR LOWER(TRIM(d.name_uz)) LIKE '%' || LOWER(TRIM(REPLACE(REPLACE(j.district_name, ' tumani', ''), ' shahri', ''))) || '%'
  )
  AND (j.district_id IS NULL OR j.district_id != d.id);

-- ==================== STEP 6: Ensure region_id matches district's region ====================
UPDATE jobs j
SET region_id = d.region_id
FROM districts d
WHERE j.district_id = d.id
  AND j.district_id IS NOT NULL
  AND (j.region_id IS NULL OR j.region_id != d.region_id);

-- ==================== STEP 7: Delete legacy external jobs (optional) ====================
-- Uncomment if you want to remove legacy external jobs entirely:
-- DELETE FROM jobs WHERE source = 'external';

-- ==================== VERIFICATION ====================
SELECT 
  source,
  COUNT(*) as total,
  COUNT(region_id) as with_region_id,
  COUNT(region_name) as with_region_name,
  COUNT(district_id) as with_district_id
FROM jobs
WHERE is_active = true
GROUP BY source;
