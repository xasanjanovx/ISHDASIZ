-- ============================================
-- FIX: Proper category mapping using mmk_group_field_ids
-- ============================================
-- osonish.uz uses mmk_group_field_ids array to determine category
-- This maps directly to their 10 main categories

-- Category mapping based on mmk_group_field_ids ranges:
-- Moliya, iqtisod, boshqaruv: 1-6
-- Qishloq xo'jaligi: 7-11
-- Axborot texnologiyalari: 12-20
-- Sanoat va ishlab chiqarish: 21-35
-- Transport: 36-40
-- Qurilish: 41
-- Ta'lim, madaniyat, sport: 42-46
-- Sog'liqni saqlash: 47
-- Xizmatlar: 48-63
-- Savdo va marketing: 64-65

-- Step 1: Reset all categories to NULL for fresh mapping
UPDATE jobs SET category_id = NULL WHERE source = 'osonish';

-- Step 2: Moliya, iqtisod, boshqaruv (IDs 1-6)
UPDATE jobs SET category_id = 'a0000006-0006-4000-8000-000000000006'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 1 AND 6
  );

-- Step 3: Qishloq xo'jaligi (IDs 7-11)
UPDATE jobs SET category_id = 'a0000008-0008-4000-8000-000000000008'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 7 AND 11
  );

-- Step 4: Axborot texnologiyalari (IDs 12-20)
UPDATE jobs SET category_id = 'a0000001-0001-4000-8000-000000000001'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 12 AND 20
  );

-- Step 5: Sanoat va ishlab chiqarish (IDs 21-35)
UPDATE jobs SET category_id = 'a0000002-0002-4000-8000-000000000002'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 21 AND 35
  );

-- Step 6: Transport (IDs 36-40)
UPDATE jobs SET category_id = 'a0000009-0009-4000-8000-000000000009'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 36 AND 40
  );

-- Step 7: Qurilish (ID 41)
UPDATE jobs SET category_id = 'a0000007-0007-4000-8000-000000000007'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int = 41
  );

-- Step 8: Ta'lim, madaniyat, sport (IDs 42-46)
UPDATE jobs SET category_id = 'a0000004-0004-4000-8000-000000000004'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 42 AND 46
  );

-- Step 9: Sog'liqni saqlash (ID 47)
UPDATE jobs SET category_id = 'a0000005-0005-4000-8000-000000000005'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int = 47
  );

-- Step 10: Xizmatlar (IDs 48-63)
UPDATE jobs SET category_id = 'a0000003-0003-4000-8000-000000000003'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 48 AND 63
  );

-- Step 11: Savdo va marketing (IDs 64-65)
UPDATE jobs SET category_id = 'a0000010-0010-4000-8000-000000000010'
WHERE source = 'osonish' AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(raw_source_json->'mmk_group_field_ids') AS field_id
    WHERE field_id::int BETWEEN 64 AND 65
  );

-- Step 12: Remaining osonish jobs without field_ids -> Boshqa
UPDATE jobs SET category_id = 'a0000011-0011-4000-8000-000000000011'
WHERE source = 'osonish' AND category_id IS NULL;

-- Step 13: Non-osonish jobs (manual entry) - use keyword matching
UPDATE jobs SET category_id = 'a0000001-0001-4000-8000-000000000001'
WHERE source IS NULL AND category_id IS NULL
  AND LOWER(title_uz || ' ' || COALESCE(title_ru, '')) ~ 'dasturchi|developer|it\s|программист';

UPDATE jobs SET category_id = 'a0000011-0011-4000-8000-000000000011'
WHERE category_id IS NULL;

-- Verify results
SELECT 
    c.name_uz as category,
    c.sort_order,
    COUNT(j.id) as job_count
FROM categories c
LEFT JOIN jobs j ON j.category_id = c.id AND j.is_active = true
GROUP BY c.id, c.name_uz, c.sort_order
ORDER BY job_count DESC;
