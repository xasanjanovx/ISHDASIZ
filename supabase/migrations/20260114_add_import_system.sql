-- Migration: Add external vacancy import support (ENHANCED)
-- Date: 2026-01-14
-- Updated: Added last_seen_at, last_checked_at, improved statistics

-- =============================================================================
-- 1. Add import-related columns to jobs table
-- =============================================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_url TEXT; -- external_url (internal only)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_status TEXT DEFAULT 'active'; -- active, removed_at_source, filled
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ; -- Last sync attempt
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ; -- Last time found on source
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ; -- Last time we checked source

-- Add comments for clarity
COMMENT ON COLUMN jobs.source IS 'Origin of the job: local, osonish, headhunter, etc.';
COMMENT ON COLUMN jobs.source_id IS 'External ID from the source site';
COMMENT ON COLUMN jobs.source_url IS 'Full URL on source site (NEVER expose to users)';
COMMENT ON COLUMN jobs.is_imported IS 'True if imported from external source';
COMMENT ON COLUMN jobs.source_status IS 'active=found, removed_at_source=404/missing, filled=explicitly closed';
COMMENT ON COLUMN jobs.last_synced_at IS 'Timestamp of last sync attempt';
COMMENT ON COLUMN jobs.last_seen_at IS 'Last time vacancy was found on source (if 404, not updated)';
COMMENT ON COLUMN jobs.last_checked_at IS 'Last time we checked the source URL';

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_source_id ON jobs(source, source_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_imported ON jobs(is_imported) WHERE is_imported = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_source_status ON jobs(source_status) WHERE is_imported = TRUE;

-- =============================================================================
-- 2. Create import_logs table for tracking import operations
-- =============================================================================

CREATE TABLE IF NOT EXISTS import_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running', -- running, completed, completed_with_errors, failed
    
    -- Import Statistics
    total_found INTEGER DEFAULT 0,
    new_imported INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    validation_errors INTEGER DEFAULT 0,
    
    -- Sync Statistics (separate from import)
    total_checked INTEGER DEFAULT 0,
    still_active INTEGER DEFAULT 0,
    removed_at_source INTEGER DEFAULT 0, -- 404 / not found
    marked_filled INTEGER DEFAULT 0, -- explicitly closed
    
    -- Error details (JSON array)
    error_details JSONB,
    
    -- Metadata
    triggered_by TEXT DEFAULT 'cron', -- cron, manual, api
    operation_type TEXT DEFAULT 'import', -- import, sync
    notes TEXT
);

COMMENT ON TABLE import_logs IS 'Tracks all import/sync operations for monitoring and debugging';

-- Index for querying recent logs
CREATE INDEX IF NOT EXISTS idx_import_logs_source_date ON import_logs(source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_logs_operation ON import_logs(operation_type, started_at DESC);

-- =============================================================================
-- 3. Add unique constraint for source + source_id (prevents duplicates)
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_unique 
ON jobs(source, source_id) 
WHERE source_id IS NOT NULL;
