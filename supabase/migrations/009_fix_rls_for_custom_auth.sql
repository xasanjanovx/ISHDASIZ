-- ============================================
-- 009_FIX_RLS_FOR_CUSTOM_AUTH.SQL
-- Since we use custom auth (not Supabase Auth),
-- auth.uid() returns null. Allow anon access.
-- ============================================

-- Allow anon to read employer_profiles (needed to get employer_id when creating vacancy)
DROP POLICY IF EXISTS "Employers can view own profile" ON employer_profiles;
DROP POLICY IF EXISTS "Anyone can read employer_profiles" ON employer_profiles;

CREATE POLICY "Anyone can read employer_profiles" 
ON employer_profiles FOR SELECT 
TO anon, authenticated
USING (true);

-- Allow anon to update employer_profiles (user checks are done in app code)
DROP POLICY IF EXISTS "Employers can update own profile" ON employer_profiles;
DROP POLICY IF EXISTS "Anyone can update employer_profiles" ON employer_profiles;

CREATE POLICY "Anyone can update employer_profiles" 
ON employer_profiles FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow anon to insert employer_profiles
DROP POLICY IF EXISTS "Employers can insert own profile" ON employer_profiles;
DROP POLICY IF EXISTS "Anyone can insert employer_profiles" ON employer_profiles;

CREATE POLICY "Anyone can insert employer_profiles" 
ON employer_profiles FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Fix jobs RLS - allow anyone to read all jobs (not just active)
DROP POLICY IF EXISTS "Jobs are readable" ON jobs;
DROP POLICY IF EXISTS "Active jobs are publicly readable" ON jobs;

CREATE POLICY "Anyone can read jobs" 
ON jobs FOR SELECT 
TO anon, authenticated
USING (true);

-- Allow anyone to update jobs (for now, security in app code)
DROP POLICY IF EXISTS "Employers can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can update jobs" ON jobs;

CREATE POLICY "Anyone can update jobs" 
ON jobs FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Ensure jobs insert policy exists
DROP POLICY IF EXISTS "Anyone can insert jobs" ON jobs;
CREATE POLICY "Anyone can insert jobs" 
ON jobs FOR INSERT 
TO anon, authenticated
WITH CHECK (true);
