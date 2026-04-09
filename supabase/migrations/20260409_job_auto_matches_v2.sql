-- Auto-match storage for seeker-facing recommendations.
-- Keeps explicit recommendation records and seeker responses.

CREATE TABLE IF NOT EXISTS public.job_auto_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id UUID,
  telegram_user_id BIGINT,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  seeker_response TEXT CHECK (seeker_response IN ('interested', 'not_interested')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_auto_matches_job
  ON public.job_auto_matches(job_id);

CREATE INDEX IF NOT EXISTS idx_job_auto_matches_user
  ON public.job_auto_matches(user_id);

CREATE INDEX IF NOT EXISTS idx_job_auto_matches_telegram_user
  ON public.job_auto_matches(telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_job_auto_matches_created_at
  ON public.job_auto_matches(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_auto_matches_job_resume_unique
  ON public.job_auto_matches(job_id, resume_id);

ALTER TABLE public.job_auto_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own auto matches" ON public.job_auto_matches;
CREATE POLICY "Users can read own auto matches"
  ON public.job_auto_matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own auto matches" ON public.job_auto_matches;
CREATE POLICY "Users can update own auto matches"
  ON public.job_auto_matches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

