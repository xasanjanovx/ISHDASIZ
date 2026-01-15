-- ============================================
-- 20260114_add_import_fields.sql
-- Add fields for OsonIsh.uz import
-- ============================================

-- 1. Add work_mode (onsite/remote/hybrid) — separate from employment_type
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_mode TEXT;
COMMENT ON COLUMN jobs.work_mode IS 'Work mode: onsite, remote, hybrid';

-- 2. Add is_for_graduates flag (for_whos = 2)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_graduates BOOLEAN DEFAULT FALSE;

-- 3. Add location coordinates
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- 4. Add location text fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS region_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS district_name TEXT;

-- 5. Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_is_for_graduates ON jobs(is_for_graduates);
CREATE INDEX IF NOT EXISTS idx_jobs_coordinates ON jobs(latitude, longitude) WHERE latitude IS NOT NULL;

-- 6. Update existing import fields if not present (from previous migration)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_status TEXT DEFAULT 'active';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- 7. Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_source_id ON jobs(source, source_id) WHERE source_id IS NOT NULL;

-- 8. Import logs table (if not exists)
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    triggered_by TEXT DEFAULT 'manual',
    operation_type TEXT DEFAULT 'import',
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    total_found INTEGER DEFAULT 0,
    new_imported INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    removed_at_source INTEGER DEFAULT 0,
    marked_filled INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Raw source JSON for full detail storage
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS raw_source_json JSONB;
COMMENT ON COLUMN jobs.raw_source_json IS 'Complete JSON from source API for imported vacancies';

-- 10. Additional fields for UI parity
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS working_hours TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hr_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS additional_phone TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vacancy_count INTEGER DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
