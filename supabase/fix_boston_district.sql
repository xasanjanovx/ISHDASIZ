/*
  Update Bo'z tumani to Bo'ston tumani
  Run this in Supabase SQL Editor to fix existing data
*/

UPDATE districts 
SET 
  name_uz = 'Bo''ston tumani', 
  name_ru = 'Бустанский район'
WHERE 
  name_uz = 'Bo''z tumani' 
  OR name_uz LIKE '%Bo''z%';
