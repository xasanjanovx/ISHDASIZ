-- Additive migration; deploy with the protected account/resumes routes.
BEGIN;
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS found_job BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS found_job_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_resumes_found_job ON public.resumes(found_job) WHERE found_job = true;
CREATE OR REPLACE FUNCTION public.ishdasiz_resume_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ishdasiz_resume_updated_at ON public.resumes;
CREATE TRIGGER ishdasiz_resume_updated_at BEFORE UPDATE ON public.resumes
FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_resume_updated_at();
COMMIT;
