-- ============================================
-- 010_ADD_ALL_EMPLOYER_PROFILE_COLUMNS.SQL
-- Add all fields needed for employer profile page
-- ============================================

-- Add all missing columns to employer_profiles
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS inn VARCHAR(20);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS director_name VARCHAR(255);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS verified_via VARCHAR(30);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure user_id has unique constraint for upsert
ALTER TABLE employer_profiles DROP CONSTRAINT IF EXISTS employer_profiles_user_id_key;
ALTER TABLE employer_profiles ADD CONSTRAINT employer_profiles_user_id_key UNIQUE (user_id);

-- RLS policies for employer_profiles (allow all for custom auth)
DROP POLICY IF EXISTS "Anyone can read employer_profiles" ON employer_profiles;
DROP POLICY IF EXISTS "Anyone can insert employer_profiles" ON employer_profiles;
DROP POLICY IF EXISTS "Anyone can update employer_profiles" ON employer_profiles;

CREATE POLICY "Anyone can read employer_profiles" 
ON employer_profiles FOR SELECT 
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert employer_profiles" 
ON employer_profiles FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update employer_profiles" 
ON employer_profiles FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);
