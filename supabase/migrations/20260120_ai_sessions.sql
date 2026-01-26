-- ============================================
-- AI Sessions Table for Smart HR Assistant
-- ============================================
-- Stores user profile and conversation history
-- Sessions persist until tab close (frontend) + 24h (backend)

CREATE TABLE IF NOT EXISTS ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    
    -- User profile as JSONB
    profile JSONB DEFAULT '{
        "category_id": null,
        "category_name": null,
        "subcategory": null,
        "skills": [],
        "level": null,
        "experience_years": null,
        "region_id": null,
        "region_name": null,
        "work_mode": null,
        "employment_type": null,
        "salary_min": null,
        "salary_max": null,
        "is_student": false,
        "is_graduate": false,
        "is_disabled": false,
        "gender": null,
        "exclude_keywords": [],
        "exclude_job_ids": [],
        "preferred_language": "uz",
        "profile_complete": false,
        "missing_fields": ["category"],
        "questions_asked": 0
    }'::jsonb,
    
    -- Conversation history (last 20 messages)
    messages JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_ai_sessions_session_id ON ai_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_expires_at ON ai_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated_at ON ai_sessions(updated_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.expires_at = NOW() + INTERVAL '24 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_sessions_updated_at ON ai_sessions;
CREATE TRIGGER ai_sessions_updated_at
    BEFORE UPDATE ON ai_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_sessions_updated_at();

-- Cleanup function (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS - Allow all for now (sessions are anonymous)
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all ai_sessions" ON ai_sessions;
CREATE POLICY "Allow all ai_sessions" ON ai_sessions
    FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ai_sessions TO authenticated;
GRANT ALL ON ai_sessions TO anon;
GRANT ALL ON ai_sessions TO service_role;

-- Comment
COMMENT ON TABLE ai_sessions IS 'Stores AI assistant sessions with user profile and conversation history. Expires 24h after last activity.';
