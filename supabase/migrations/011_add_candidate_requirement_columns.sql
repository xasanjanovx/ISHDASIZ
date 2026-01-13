-- ============================================
-- 011_ADD_CANDIDATE_REQUIREMENT_COLUMNS.SQL
-- Add missing columns for candidate requirements
-- (age, gender, experience, education)
-- ============================================

-- Add age limits
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS age_min INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS age_max INTEGER;

-- Add gender preference
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'any';
-- Values: any, male, female

-- Add experience requirement
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience VARCHAR(30) DEFAULT 'no_experience';
-- Values: no_experience, 1_3, 3_6, 6_plus

-- Add education level requirement
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS education_level VARCHAR(30) DEFAULT 'any';
-- Values: any, secondary, vocational, higher, master

-- Add indexes for common filters
CREATE INDEX IF NOT EXISTS idx_jobs_gender ON jobs(gender);
CREATE INDEX IF NOT EXISTS idx_jobs_experience ON jobs(experience);
CREATE INDEX IF NOT EXISTS idx_jobs_education_level ON jobs(education_level);
