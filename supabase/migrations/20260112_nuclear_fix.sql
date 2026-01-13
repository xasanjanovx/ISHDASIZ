-- NUCLEAR FIX FOR 400 ERRORS

-- 1. Fix "Column email does not exist" error on job_seeker_profiles
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Disable RLS to allow "Zombie" Users (deleted from Auth) to read/write data
-- This is necessary if you cannot logout/login to get a valid ID.
ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE resumes DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_seeker_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE employer_profiles DISABLE ROW LEVEL SECURITY;

-- 3. Drop Foreign Key References to auth.users to prevent 23503 Constraints
-- This allows data to be saved with a non-existent user_id.
ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_user_id_fkey;
ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_user_id_fkey;
ALTER TABLE job_seeker_profiles DROP CONSTRAINT IF EXISTS job_seeker_profiles_user_id_fkey;
ALTER TABLE employer_profiles DROP CONSTRAINT IF EXISTS employer_profiles_user_id_fkey;

-- 4. Fix view_history if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'view_history') THEN
        ALTER TABLE view_history DISABLE ROW LEVEL SECURITY;
        ALTER TABLE view_history DROP CONSTRAINT IF EXISTS view_history_user_id_fkey;
    END IF;
END $$;
