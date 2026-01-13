-- Employer Verification & Application System Migration
-- Run this in Supabase SQL Editor

-- 1. Add verification fields to employer_profiles
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS director_name VARCHAR(255);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 2. Add contact settings to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) DEFAULT 'direct';
-- 'direct' = contacts visible to everyone
-- 'application_only' = only via application (for verified employers)

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_telegram VARCHAR(100);

-- 3. Update applications table to include resume reference and message
ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES resumes(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_message TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_contact_type ON jobs(contact_type);
CREATE INDEX IF NOT EXISTS idx_employer_verified ON employer_profiles(is_verified);

-- 5. Grant permissions
GRANT ALL ON employer_profiles TO anon, authenticated, service_role;
GRANT ALL ON jobs TO anon, authenticated, service_role;
GRANT ALL ON applications TO anon, authenticated, service_role;
