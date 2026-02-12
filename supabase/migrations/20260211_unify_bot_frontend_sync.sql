-- Unify schema expectations between Telegram bot and frontend.
-- Fixes environments where legacy columns are missing and data does not sync across app surfaces.

-- =========================
-- Jobs
-- =========================
ALTER TABLE IF EXISTS jobs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS field_id TEXT,
  ADD COLUMN IF NOT EXISTS field_title TEXT,
  ADD COLUMN IF NOT EXISTS region_name TEXT,
  ADD COLUMN IF NOT EXISTS district_name TEXT,
  ADD COLUMN IF NOT EXISTS hr_name TEXT,
  ADD COLUMN IF NOT EXISTS work_mode TEXT,
  ADD COLUMN IF NOT EXISTS working_days TEXT,
  ADD COLUMN IF NOT EXISTS working_hours TEXT,
  ADD COLUMN IF NOT EXISTS payment_type INTEGER,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS source_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_source_json JSONB DEFAULT '{}'::jsonb;

UPDATE jobs
SET user_id = created_by
WHERE user_id IS NULL
  AND created_by IS NOT NULL;

UPDATE jobs
SET title = COALESCE(NULLIF(title_uz, ''), NULLIF(title_ru, ''), title)
WHERE title IS NULL
   OR title = '';

CREATE INDEX IF NOT EXISTS idx_jobs_user_id_sync ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by_sync ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_field_id_sync ON jobs(field_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_sync ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source_status_sync ON jobs(source_status);

-- =========================
-- Resumes
-- =========================
ALTER TABLE IF EXISTS resumes
  ADD COLUMN IF NOT EXISTS field_id TEXT,
  ADD COLUMN IF NOT EXISTS field_title TEXT,
  ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS expected_salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'resumes'
      AND column_name = 'field_title'
  ) THEN
    UPDATE resumes
    SET field_title = COALESCE(NULLIF(field_title, ''), NULLIF(title, ''), field_title)
    WHERE field_title IS NULL
       OR field_title = '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'resumes'
      AND column_name = 'category_ids'
      AND data_type = 'jsonb'
  ) THEN
    UPDATE resumes
    SET category_ids = jsonb_build_array(category_id)
    WHERE category_id IS NOT NULL
      AND (category_ids IS NULL OR category_ids = '[]'::jsonb);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resumes_field_id_sync ON resumes(field_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status_sync ON resumes(status);
CREATE INDEX IF NOT EXISTS idx_resumes_public_status_sync ON resumes(is_public, status);
