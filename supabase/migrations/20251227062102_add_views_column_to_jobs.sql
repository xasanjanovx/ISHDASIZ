/*
  # Add views column to jobs table
  
  1. Changes
    - Add `views` column to `jobs` table with default value of 0
    - Add index on views for performance when sorting by popularity
  
  2. Notes
    - This column tracks how many times a job posting has been viewed
    - Default value ensures existing jobs have 0 views initially
*/

-- Add views column to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'views'
  ) THEN
    ALTER TABLE jobs ADD COLUMN views integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_jobs_views ON jobs(views DESC);
