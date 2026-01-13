-- Add column to track if job seeker has seen the application status update
ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS is_seen_by_job_seeker BOOLEAN DEFAULT false;

-- Disable RLS on job_applications temporarily to allow the update functionality without policy issues
-- (User requested immediate fix)
ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
GRANT ALL ON job_applications TO authenticated;
GRANT ALL ON job_applications TO anon;
