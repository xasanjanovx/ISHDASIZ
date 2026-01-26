-- ============================================
-- Add source_category fields for auditing
-- ============================================
-- These fields store the original category from the source site
-- for debugging and improving mapping rules

-- Step 1: Add source_category field if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='jobs' AND column_name='source_category') THEN
        ALTER TABLE jobs ADD COLUMN source_category TEXT;
    END IF;
END $$;

-- Step 2: Add source_subcategory field if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='jobs' AND column_name='source_subcategory') THEN
        ALTER TABLE jobs ADD COLUMN source_subcategory TEXT;
    END IF;
END $$;

-- Step 3: Create index for auditing queries
CREATE INDEX IF NOT EXISTS idx_jobs_source_category ON jobs(source_category);

-- Step 4: Verify
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name IN ('source_category', 'source_subcategory', 'source');
