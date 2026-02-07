-- Store strict + AI recommendation scores for bot reuse

CREATE TABLE IF NOT EXISTS telegram_match_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('seeker_to_job', 'employer_to_resume')),
  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  strict_score INTEGER CHECK (strict_score >= 0 AND strict_score <= 100),
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(direction, source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_tmr_direction_source_score
  ON telegram_match_recommendations(direction, source_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_tmr_target
  ON telegram_match_recommendations(target_id);

ALTER TABLE telegram_match_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on telegram_match_recommendations" ON telegram_match_recommendations;
CREATE POLICY "Service role full access on telegram_match_recommendations"
  ON telegram_match_recommendations FOR ALL
  USING (true);

CREATE OR REPLACE FUNCTION update_tmr_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tmr_updated_at ON telegram_match_recommendations;
CREATE TRIGGER tmr_updated_at
  BEFORE UPDATE ON telegram_match_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_tmr_timestamp();

