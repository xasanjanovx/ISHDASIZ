-- Job offers from employers to seekers (bot/frontend sync).

CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  employer_user_id UUID,
  seeker_user_id UUID,
  status TEXT NOT NULL DEFAULT 'sent',
  message TEXT,
  seen_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_offers_seeker ON job_offers(seeker_user_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_employer ON job_offers(employer_user_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_job_resume ON job_offers(job_id, resume_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers(status);
CREATE INDEX IF NOT EXISTS idx_job_offers_created_at ON job_offers(created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_job_offers_updated_at ON job_offers;
    CREATE TRIGGER trg_job_offers_updated_at
      BEFORE UPDATE ON job_offers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE job_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_offers'
      AND policyname = 'Seeker can read own offers'
  ) THEN
    CREATE POLICY "Seeker can read own offers"
      ON job_offers
      FOR SELECT
      TO authenticated
      USING (seeker_user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_offers'
      AND policyname = 'Employer can read own sent offers'
  ) THEN
    CREATE POLICY "Employer can read own sent offers"
      ON job_offers
      FOR SELECT
      TO authenticated
      USING (employer_user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_offers'
      AND policyname = 'Employer can create offers'
  ) THEN
    CREATE POLICY "Employer can create offers"
      ON job_offers
      FOR INSERT
      TO authenticated
      WITH CHECK (employer_user_id = auth.uid());
  END IF;
END $$;

