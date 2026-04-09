-- Application pipeline v2
-- Adds interview/decision fields, normalizes statuses, and restores RLS safety.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS interview_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_address TEXT,
  ADD COLUMN IF NOT EXISTS employer_phone TEXT,
  ADD COLUMN IF NOT EXISTS employer_message TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS match_score INTEGER,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seeker_telegram_id BIGINT,
  ADD COLUMN IF NOT EXISTS employer_telegram_id BIGINT,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS applicant_id UUID,
  ADD COLUMN IF NOT EXISTS resume_id UUID,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_seen_by_job_seeker BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Normalize legacy statuses to v2 workflow.
UPDATE public.job_applications
SET status = CASE
  WHEN lower(coalesce(status, '')) IN ('viewed', 'reviewed') THEN 'reviewed'
  WHEN lower(coalesce(status, '')) IN ('invited', 'interview', 'interviewed', 'interview_set') THEN 'interview_set'
  WHEN lower(coalesce(status, '')) = 'accepted' THEN 'accepted'
  WHEN lower(coalesce(status, '')) = 'rejected' THEN 'rejected'
  WHEN lower(coalesce(status, '')) = 'hired' THEN 'hired'
  ELSE 'pending'
END;

-- Drop old status checks if any.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'job_applications'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check_v2
  CHECK (status IN ('pending', 'reviewed', 'interview_set', 'accepted', 'rejected', 'hired'));

-- Backfill responded_at for already processed applications.
UPDATE public.job_applications
SET responded_at = COALESCE(responded_at, NOW())
WHERE status IN ('reviewed', 'interview_set', 'accepted', 'rejected', 'hired');

CREATE INDEX IF NOT EXISTS idx_job_applications_job_status_v2
  ON public.job_applications(job_id, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_applications'
      AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_job_applications_user_status_v2
      ON public.job_applications(user_id, status);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_applications_seeker_telegram_v2
  ON public.job_applications(seeker_telegram_id);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Remove unsafe broad grants from emergency migrations.
REVOKE ALL ON TABLE public.job_applications FROM anon;
REVOKE ALL ON TABLE public.job_applications FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.job_applications TO authenticated;
GRANT INSERT ON TABLE public.job_applications TO anon;

DROP POLICY IF EXISTS "Anyone can submit applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can read applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can view own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.job_applications;
DROP POLICY IF EXISTS "Employers can view applications for their jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants can read own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Employers can read applications for their jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Employers can update applications for their jobs" ON public.job_applications;

CREATE POLICY "Applicants can read own applications v2"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = applicant_id
    OR phone IN (
      SELECT u.phone
      FROM public.users u
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Applicants can create own applications v2"
  ON public.job_applications
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (TRUE);

CREATE POLICY "Employers can read applications for own jobs v2"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      LEFT JOIN public.employer_profiles ep ON ep.id = j.employer_id
      WHERE j.id = job_applications.job_id
        AND (
          j.created_by = auth.uid()
          OR j.user_id = auth.uid()
          OR ep.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Employers can update applications for own jobs v2"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      LEFT JOIN public.employer_profiles ep ON ep.id = j.employer_id
      WHERE j.id = job_applications.job_id
        AND (
          j.created_by = auth.uid()
          OR j.user_id = auth.uid()
          OR ep.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      LEFT JOIN public.employer_profiles ep ON ep.id = j.employer_id
      WHERE j.id = job_applications.job_id
        AND (
          j.created_by = auth.uid()
          OR j.user_id = auth.uid()
          OR ep.user_id = auth.uid()
        )
    )
  );
