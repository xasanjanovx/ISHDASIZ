-- Enable RLS for job_applications
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- 1. Job Seekers can VIEW their own applications
CREATE POLICY "Users can view own applications"
ON job_applications
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Job Seekers can INSERT their own applications
CREATE POLICY "Users can create applications"
ON job_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Employers can VIEW applications for their jobs
-- Assuming 'jobs.created_by' stores the Auth User ID of the employer
CREATE POLICY "Employers can view applications for their jobs"
ON job_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id = job_applications.job_id
    AND jobs.created_by = auth.uid()
  )
);
