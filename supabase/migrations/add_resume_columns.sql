-- SQL Migration: Add missing columns to resumes table
-- Run this in Supabase SQL Editor

-- Add category_id column (foreign key to categories)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add employment_type enum column
DO $$ BEGIN
    CREATE TYPE employment_type_enum AS ENUM ('full_time', 'part_time', 'contract', 'internship');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time';

-- Add experience level column (string)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT 'no_experience';

-- Add experience_details JSONB column (array of experience objects)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_details JSONB DEFAULT '[]'::jsonb;

-- Add experience_years numeric column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;

-- Add education_level column (string)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education_level TEXT DEFAULT 'secondary';

-- Add education JSONB column (array of education objects)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb;

-- Add skills JSONB column (array of strings)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

-- Add languages JSONB column (array of language objects)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;

-- Add about text column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS about TEXT;

-- Add desired_position text column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS desired_position TEXT;

-- Add expected_salary_min column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS expected_salary_min INTEGER;

-- Add expected_salary_max column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER;

-- Add gender column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'any';

-- Add is_public boolean column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Add status column
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add district_id if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id) ON DELETE SET NULL;

-- Add city column if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS city TEXT;

-- Add birth_date column if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Add phone column if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add full_name column if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add title column if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS title TEXT;

-- Add created_at and updated_at timestamps
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_district_id ON resumes(district_id);
CREATE INDEX IF NOT EXISTS idx_resumes_category_id ON resumes(category_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);

-- Grant permissions (adjust as needed for your RLS policies)
-- GRANT ALL ON resumes TO authenticated;

SELECT 'Migration completed successfully!' as result;
