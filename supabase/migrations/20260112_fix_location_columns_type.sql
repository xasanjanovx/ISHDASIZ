-- Fix district_id type to bigint (int8)
-- Handles cases where column is missing (creation failed) or exists with wrong type.

-- 1. job_seeker_profiles
DO $$
BEGIN
    -- Check if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_seeker_profiles' AND column_name = 'district_id') THEN
        -- Column exists, try to fix type
        -- Drop FK if exists
        ALTER TABLE job_seeker_profiles DROP CONSTRAINT IF EXISTS job_seeker_profiles_district_id_fkey;
        
        -- Alter type to bigint
        ALTER TABLE job_seeker_profiles ALTER COLUMN district_id TYPE bigint USING (
            CASE 
                WHEN district_id::text ~ '^[0-9]+$' THEN district_id::text::bigint
                ELSE NULL
            END
        );
    ELSE
        -- Column does not exist, add it
        ALTER TABLE job_seeker_profiles ADD COLUMN district_id bigint;
    END IF;

    -- Add FK constraint (safely)
    BEGIN
        ALTER TABLE job_seeker_profiles ADD CONSTRAINT job_seeker_profiles_district_id_fkey 
        FOREIGN KEY (district_id) REFERENCES districts(id);
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;
END $$;

-- 2. employer_profiles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employer_profiles' AND column_name = 'district_id') THEN
        ALTER TABLE employer_profiles DROP CONSTRAINT IF EXISTS employer_profiles_district_id_fkey;
        
        ALTER TABLE employer_profiles ALTER COLUMN district_id TYPE bigint USING (
            CASE 
                WHEN district_id::text ~ '^[0-9]+$' THEN district_id::text::bigint
                ELSE NULL
            END
        );
    ELSE
        ALTER TABLE employer_profiles ADD COLUMN district_id bigint;
    END IF;

    BEGIN
        ALTER TABLE employer_profiles ADD CONSTRAINT employer_profiles_district_id_fkey 
        FOREIGN KEY (district_id) REFERENCES districts(id);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
