-- Add contact_email column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_email TEXT;
