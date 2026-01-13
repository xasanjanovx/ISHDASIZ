-- Add telegram column to job_seeker_profiles
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS telegram text;

-- Add telegram column to employer_profiles
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS telegram text;
