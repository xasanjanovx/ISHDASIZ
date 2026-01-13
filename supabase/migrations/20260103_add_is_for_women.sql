-- Add special category columns
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS is_for_students BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_for_disabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_for_women BOOLEAN DEFAULT false;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
