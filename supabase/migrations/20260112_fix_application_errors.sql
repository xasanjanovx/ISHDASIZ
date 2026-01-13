-- SQL Fixes for Application Errors

-- 1. Fix "409 Conflict" (You already applied):
-- Run this line to CLEAR ALL applications so you can start testing from scratch.
truncate table job_applications cascade;

-- 2. Fix "23503 Key is not present in table users" (Invalid Session ID):
-- This error happens because your browser has an old User ID that doesn't exist in the database.
-- OPTION A (Recommended): Log Out and Log In.
-- OPTION B (SQL Workaround): Remove the strict check so you can save even with a "fake" ID.
-- WARNING: This allows bad data. Only use for testing.
ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_user_id_fkey;

-- If you want to restore the check later:
-- ALTER TABLE job_applications ADD CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
