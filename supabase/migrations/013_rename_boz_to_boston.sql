-- ============================================
-- 013_RENAME_BOZ_TO_BOSTON.SQL
-- Rename Bo'z tumani to Bo'ston tumani
-- ============================================

-- Update district name from Bo'z to Bo'ston
UPDATE districts 
SET name_uz = 'Bo''ston tumani', name_ru = 'Бостанский район'
WHERE name_uz LIKE '%Bo''z%' OR name_uz LIKE '%Boz%';

-- Also update if stored differently
UPDATE districts 
SET name_uz = 'Bo''ston tumani', name_ru = 'Бостанский район'
WHERE name_uz = 'Bo''z tumani' OR name_uz = 'Boz tumani';
