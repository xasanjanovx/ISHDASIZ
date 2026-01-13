-- Migration: Unify Location Columns
-- Date: 2026-01-12
-- Goal: Ensure all main tables have region_id (int8) and district_id (text) for unified filtering

-- 1. job_seeker_profiles
-- Check/Add columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_seeker_profiles' AND column_name = 'region_id') THEN
        ALTER TABLE job_seeker_profiles ADD COLUMN region_id bigint REFERENCES regions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_seeker_profiles' AND column_name = 'district_id') THEN
        ALTER TABLE job_seeker_profiles ADD COLUMN district_id uuid REFERENCES districts(id);
    END IF;
END $$;

-- 2. employer_profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employer_profiles' AND column_name = 'region_id') THEN
        ALTER TABLE employer_profiles ADD COLUMN region_id bigint REFERENCES regions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employer_profiles' AND column_name = 'district_id') THEN
        ALTER TABLE employer_profiles ADD COLUMN district_id uuid REFERENCES districts(id);
    END IF;
END $$;

-- 3. resumes
-- Already has district_id text? Check types.db says string.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resumes' AND column_name = 'region_id') THEN
        ALTER TABLE resumes ADD COLUMN region_id bigint REFERENCES regions(id);
    END IF;
    -- Ensure district_id exists (it might be missing in DB even if in types)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resumes' AND column_name = 'district_id') THEN
        ALTER TABLE resumes ADD COLUMN district_id uuid REFERENCES districts(id);
    END IF;
END $$;

-- 4. jobs
-- Already has region_id and district_id in types, ensuring DB matches
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'region_id') THEN
        ALTER TABLE jobs ADD COLUMN region_id bigint REFERENCES regions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'district_id') THEN
        ALTER TABLE jobs ADD COLUMN district_id uuid REFERENCES districts(id);
    END IF;
END $$;

-- 5. Migrate existing data (Best effort)
-- If 'city' column holds district_id (which is common in early implementations), migrate it.
-- For job_seeker_profiles
UPDATE job_seeker_profiles 
SET district_id = city::uuid 
WHERE district_id IS NULL AND city IS NOT NULL AND city ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; -- Only if it looks like a UUID

-- For employer_profiles (if it has city column? Types didn't show it but previous code referenced it)
-- Code referenced profileData.city -> mapped to district_id.
-- If 'city' column doesn't exist in employer_profiles, we skip.
-- (Note: Types showed 'address', 'inn', etc. but 'city' only in logic, not explicit type row?)
-- Types had: `city: string | null` in job_seeker_profiles.
-- Types had: `company_name ...` in employer_profiles. No `city`. 
-- But code was `district: profileData.city`. 
-- So we need to ensure the column is there.

-- 6. Grant permissions (just in case)
GRANT SELECT, INSERT, UPDATE ON job_seeker_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON employer_profiles TO authenticated;
