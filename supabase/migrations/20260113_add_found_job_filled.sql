-- Add found_job columns to resumes table
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS found_job BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS found_job_at TIMESTAMPTZ;

-- Add is_filled columns to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS is_filled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_resumes_found_job ON resumes(found_job) WHERE found_job = true;
CREATE INDEX IF NOT EXISTS idx_jobs_is_filled ON jobs(is_filled) WHERE is_filled = true;
