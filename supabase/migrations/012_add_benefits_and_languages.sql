-- ============================================
-- 012_ADD_BENEFITS_AND_LANGUAGES.SQL
-- Add benefits and languages columns to jobs
-- ============================================

-- Add benefits text field
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS benefits TEXT;

-- Add languages JSONB field for storing language requirements
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb;
