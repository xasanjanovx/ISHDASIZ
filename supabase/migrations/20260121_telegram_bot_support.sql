-- Telegram Bot Support Migration
-- Adds telegram_user_id, seeker geolocation, and session management

-- ========================================
-- 1. USERS - Add telegram_user_id for linking
-- ========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_user_id) WHERE telegram_user_id IS NOT NULL;

COMMENT ON COLUMN users.telegram_user_id IS 'Telegram user ID for bot integration';

-- ========================================
-- 2. JOB_SEEKER_PROFILES - Add geolocation fields
-- ========================================
ALTER TABLE job_seeker_profiles 
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_seeker_location 
  ON job_seeker_profiles(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN job_seeker_profiles.latitude IS 'Job seeker location latitude from Telegram';
COMMENT ON COLUMN job_seeker_profiles.longitude IS 'Job seeker location longitude from Telegram';
COMMENT ON COLUMN job_seeker_profiles.location_address IS 'Reverse-geocoded address text';

-- ========================================
-- 3. TELEGRAM_SESSIONS - Bot state machine
-- ========================================
CREATE TABLE IF NOT EXISTS telegram_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'start',
  data JSONB DEFAULT '{}'::jsonb,
  phone VARCHAR(20),
  otp_code VARCHAR(6),
  otp_expires_at TIMESTAMPTZ,
  lang VARCHAR(5) DEFAULT 'uz',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_session_unique ON telegram_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_tg_session_user ON telegram_sessions(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE telegram_sessions IS 'Telegram bot conversation state and temporary auth data';

-- ========================================
-- 4. Enable RLS for telegram_sessions
-- ========================================
ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on telegram_sessions" 
  ON telegram_sessions FOR ALL 
  USING (true);

-- ========================================
-- 5. Function to update session timestamp
-- ========================================
CREATE OR REPLACE FUNCTION update_telegram_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_session_updated ON telegram_sessions;
CREATE TRIGGER tg_session_updated
  BEFORE UPDATE ON telegram_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_session_timestamp();

-- ========================================
-- 6. Cleanup old sessions (can be called by cron)
-- ========================================
CREATE OR REPLACE FUNCTION cleanup_old_telegram_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM telegram_sessions 
  WHERE updated_at < NOW() - INTERVAL '30 days'
  AND user_id IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- DONE
-- ========================================
