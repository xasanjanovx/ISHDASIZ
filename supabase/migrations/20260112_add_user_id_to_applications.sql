-- Migration: Add user_id to job_applications
-- Date: 2026-01-12

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_applications' AND column_name = 'user_id') THEN
        ALTER TABLE job_applications ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;
END $$;
