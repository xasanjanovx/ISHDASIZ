BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ishdasiz_profile_updated_at ON public.job_seeker_profiles;
CREATE TRIGGER ishdasiz_profile_updated_at BEFORE UPDATE ON public.job_seeker_profiles FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_profile_updated_at();
DROP TRIGGER IF EXISTS ishdasiz_profile_updated_at ON public.employer_profiles;
CREATE TRIGGER ishdasiz_profile_updated_at BEFORE UPDATE ON public.employer_profiles FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_profile_updated_at();
COMMIT;
