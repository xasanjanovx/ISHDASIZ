-- Migration: Cleanup District Names for 2026
-- Date: 2026-01-12

-- 1. Rename Bo'z district to Bo'ston (Andijan region)
-- This handles the official renaming of Bo'z District to Bo'ston District
UPDATE districts 
SET name_uz = 'Bo''ston tumani', 
    name_ru = 'Бустанский район'
WHERE name_uz ILIKE 'Bo''z%' OR name_uz = 'Boz tumani';

-- 2. Clean up any other potential old names (example placeholder)
-- UPDATE districts SET name_uz = 'Jalaquduq tumani' WHERE name_uz ILIKE 'Jalaqud%';

-- 3. Ensure consistency in city names (Andijon shahri, etc.)
UPDATE districts SET name_uz = 'Andijon shahri' WHERE name_uz = 'Andijon sh' OR name_uz = 'Andijon sh.';

-- 4. Clean up jobs referencing invalid districts (Optional, but good for integrity)
-- DELETE FROM jobs WHERE district_id NOT IN (SELECT id FROM districts) AND district_id IS NOT NULL;
