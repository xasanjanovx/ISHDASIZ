-- Remove duplicate applications, keeping the most recent one
DELETE FROM job_applications a
USING job_applications b
WHERE a.created_at < b.created_at
AND a.user_id = b.user_id
AND a.job_id = b.job_id
AND a.id != b.id;

-- Add Unique Constraint to prevent future duplicates
ALTER TABLE job_applications 
ADD CONSTRAINT unique_user_job_application UNIQUE (user_id, job_id);
