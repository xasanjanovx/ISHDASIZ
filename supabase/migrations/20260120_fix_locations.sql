-- ============================================
-- FIX: Proper region mapping using osonish.uz region IDs
-- ============================================
-- osonish.uz has region.id in filial.region.id
-- We need to map these to our regions table

-- Step 1: Update region_name from raw_source_json (always overwrite for accuracy)
UPDATE jobs
SET region_name = raw_source_json->'filial'->'region'->>'name_uz'
WHERE source = 'osonish'
  AND raw_source_json->'filial'->'region'->>'name_uz' IS NOT NULL;

-- Step 2: Update district_name from raw_source_json
UPDATE jobs
SET district_name = raw_source_json->'filial'->'city'->>'name_uz'
WHERE source = 'osonish'
  AND raw_source_json->'filial'->'city'->>'name_uz' IS NOT NULL;

-- Step 3: Fill address from raw JSON
UPDATE jobs
SET address = raw_source_json->'filial'->>'address'
WHERE source = 'osonish'
  AND raw_source_json->'filial'->>'address' IS NOT NULL;

-- Step 4: Reset region_id for fresh mapping
UPDATE jobs SET region_id = NULL WHERE source = 'osonish';

-- Step 5: Map osonish region IDs to our regions
-- Based on osonish.uz API /api/api/v1/regions

-- Toshkent shahri (osonish id: 1)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug = 'toshkent-shahri' LIMIT 1)
WHERE source = 'osonish' 
  AND (raw_source_json->'filial'->'region'->>'id')::int = 1;

-- Toshkent viloyati (osonish id: 2)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug = 'toshkent-viloyati' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 2;

-- Andijon (osonish id: 3)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%andijon%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 3;

-- Buxoro (osonish id: 4)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%buxoro%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 4;

-- Jizzax (osonish id: 5)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%jizzax%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 5;

-- Qashqadaryo (osonish id: 6)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%qashqa%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 6;

-- Navoiy (osonish id: 7)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%navoiy%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 7;

-- Namangan (osonish id: 8)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%namangan%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 8;

-- Samarqand (osonish id: 9)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%samarqand%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 9;

-- Surxondaryo (osonish id: 10)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%surxon%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 10;

-- Sirdaryo (osonish id: 11)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%sirdaryo%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 11;

-- Farg'ona (osonish id: 12)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%farg%ona%' OR name_uz ILIKE '%farg%ona%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 12;

-- Xorazm (osonish id: 13)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%xorazm%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 13;

-- Qoraqalpog'iston (osonish id: 14)
UPDATE jobs SET region_id = (SELECT id FROM regions WHERE slug ILIKE '%qoraqalpog%' OR name_uz ILIKE '%qoraqalpog%' LIMIT 1)
WHERE source = 'osonish'
  AND (raw_source_json->'filial'->'region'->>'id')::int = 14;

-- Step 6: Fallback - match by exact region name for remaining
UPDATE jobs j
SET region_id = r.id
FROM regions r
WHERE j.source = 'osonish'
  AND j.region_id IS NULL
  AND j.region_name IS NOT NULL
  AND (
    LOWER(TRIM(j.region_name)) = LOWER(TRIM(r.name_uz))
    OR LOWER(TRIM(j.region_name)) = LOWER(TRIM(r.name_ru))
  );

-- Step 7: Verify region mapping
SELECT 
    r.name_uz as region,
    COUNT(j.id) as job_count
FROM regions r
LEFT JOIN jobs j ON j.region_id = r.id AND j.is_active = true
GROUP BY r.id, r.name_uz
ORDER BY job_count DESC;

-- Step 8: Show jobs without region_id
SELECT 
    COALESCE(region_name, 'NO REGION NAME') as region_name,
    COUNT(*) as count
FROM jobs 
WHERE is_active = true AND region_id IS NULL
GROUP BY region_name
ORDER BY count DESC
LIMIT 20;
