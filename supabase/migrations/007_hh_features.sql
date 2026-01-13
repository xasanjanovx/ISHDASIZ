-- ============================================
-- 007_HH_FEATURES.SQL
-- Add tables for hh.ru-like features:
-- - favorites (bookmarks)
-- - view_history (recently viewed)
-- - Update job_applications for resume selection
-- ============================================

-- 1. FAVORITES TABLE (Job bookmarks for job seekers)
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_job_id ON favorites(job_id);

-- 2. VIEW HISTORY TABLE (Track which jobs users viewed)
CREATE TABLE IF NOT EXISTS view_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_view_history_user_id ON view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_view_history_viewed_at ON view_history(viewed_at DESC);

-- 3. UPDATE JOB_APPLICATIONS for resume linking and status tracking
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
-- Status values: pending, viewed, invited, rejected, hired

-- 4. Add employer_id to job_applications for easier querying
-- First we need to get it from the job
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES employer_profiles(id) ON DELETE SET NULL;

-- 5. Update experience filter support - add to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_level VARCHAR(30);
-- Values: no_experience, 1_3_years, 3_6_years, 6_plus_years

-- 6. Add posted_at column if not exists (should use created_at but let's be explicit)
-- created_at already exists, we'll use it

-- 7. RESUME SEARCH - Ensure resumes have searchable fields
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS desired_position VARCHAR(255);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;

-- 8. CONVERSATIONS - Update for proper chat support
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL;

-- 9. Grant permissions
GRANT ALL ON favorites TO anon, authenticated;
GRANT ALL ON view_history TO anon, authenticated;
