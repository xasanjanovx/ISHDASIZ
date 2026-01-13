-- ============================================
-- 008_ADD_MISSING_JOB_COLUMNS.SQL
-- Add missing columns for enhanced vacancy form
-- ============================================

-- Add employment type 'remote' option
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_employment_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_employment_type_check 
  CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship', 'remote'));

-- Add contact fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_telegram TEXT;

-- Add employer link
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES employer_profiles(id) ON DELETE SET NULL;

-- Add status field (for moderation)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
-- Status values: draft, pending, active, expired, rejected

-- Add special category flags
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_students BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_women BOOLEAN DEFAULT FALSE;

-- Update RLS to allow employers to insert their own jobs
DROP POLICY IF EXISTS "Employers can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can insert jobs" ON jobs;

-- Allow anyone to insert jobs (since we use custom auth, not Supabase Auth)
CREATE POLICY "Anyone can insert jobs"
  ON jobs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);


-- Allow employers to update their own jobs
DROP POLICY IF EXISTS "Employers can update own jobs" ON jobs;
CREATE POLICY "Employers can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    employer_id IN (
      SELECT id FROM employer_profiles WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE admin_profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    employer_id IN (
      SELECT id FROM employer_profiles WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM admin_profiles WHERE admin_profiles.id = auth.uid()
    )
  );

-- Allow reading all active jobs + own jobs
DROP POLICY IF EXISTS "Active jobs are publicly readable" ON jobs;
CREATE POLICY "Jobs are readable"
  ON jobs FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true 
    OR status = 'active'
    OR employer_id IN (
      SELECT id FROM employer_profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM admin_profiles WHERE admin_profiles.id = auth.uid()
    )
  );

-- Create index for employer lookup
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
