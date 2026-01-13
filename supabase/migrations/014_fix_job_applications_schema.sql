-- ============================================
-- 014_FIX_JOB_APPLICATIONS_SCHEMA.SQL
-- Add missing columns for full application system
-- ============================================

-- Add applicant_id to track which user submitted the application
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS applicant_id UUID;

-- Add status column for application workflow
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Add viewed_at timestamp for tracking when employer saw the application
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Add resume_id to link to the submitted resume
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_id UUID;

-- Create index for faster queries by applicant
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_phone ON job_applications(phone);

-- Update RLS policies to allow applicants to see their own applications
-- First, drop the existing policy if it exists
DROP POLICY IF EXISTS "Applicants can read own applications" ON job_applications;

CREATE POLICY "Applicants can read own applications"
  ON job_applications FOR SELECT
  TO authenticated
  USING (
    phone IN (
      SELECT phone FROM users WHERE id = auth.uid()
    )
    OR 
    applicant_id IN (
      SELECT id FROM job_seeker_profiles WHERE user_id = auth.uid()
    )
  );

-- Allow employers to see applications for their jobs
DROP POLICY IF EXISTS "Employers can read applications for their jobs" ON job_applications;

CREATE POLICY "Employers can read applications for their jobs"
  ON job_applications FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN employer_profiles ep ON j.employer_id = ep.id
      WHERE ep.user_id = auth.uid()
    )
  );

-- Allow employers to update applications (status, viewed_at)
DROP POLICY IF EXISTS "Employers can update applications for their jobs" ON job_applications;

CREATE POLICY "Employers can update applications for their jobs"
  ON job_applications FOR UPDATE
  TO authenticated
  USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN employer_profiles ep ON j.employer_id = ep.id
      WHERE ep.user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN employer_profiles ep ON j.employer_id = ep.id
      WHERE ep.user_id = auth.uid()
    )
  );

-- ============================================
-- DONE!
-- Run this migration in Supabase SQL Editor
-- ============================================
