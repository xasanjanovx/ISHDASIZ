-- Apply with the site and BOTH bot releases. No accounts or histories are deleted.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0 CHECK (session_version >= 0);
CREATE TABLE IF NOT EXISTS public.account_publication_snapshots (
  user_id uuid NOT NULL REFERENCES public.users(id),
  session_version integer NOT NULL,
  table_name text NOT NULL CHECK (table_name IN ('jobs','resumes')),
  item_id uuid NOT NULL,
  publication jsonb NOT NULL,
  PRIMARY KEY(user_id, session_version, table_name, item_id)
);
ALTER TABLE public.account_publication_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_publication_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_publication_snapshots TO service_role;

-- Used by restrictive public policies even when users is private.
CREATE OR REPLACE FUNCTION public.ishdasiz_account_open(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_user_id IS NULL OR EXISTS (SELECT 1 FROM public.users WHERE id=p_user_id AND closed_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_account_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_account_open(uuid) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_owner(p_employer uuid, p_user uuid, p_creator uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN p_employer IS NOT NULL THEN (SELECT user_id FROM public.employer_profiles WHERE id=p_employer)
    ELSE COALESCE(p_user,p_creator) END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_job_owner(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_owner(uuid,uuid,uuid) TO anon, authenticated, service_role;
DROP POLICY IF EXISTS ishdasiz_open_account ON public.jobs;
CREATE POLICY ishdasiz_open_account ON public.jobs AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING(public.ishdasiz_account_open(public.ishdasiz_job_owner(employer_id,user_id,created_by)));
DROP POLICY IF EXISTS ishdasiz_open_account ON public.resumes;
CREATE POLICY ishdasiz_open_account ON public.resumes AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING(public.ishdasiz_account_open(user_id));
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['job_seeker_profiles','employer_profiles'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
    EXECUTE format('DROP POLICY IF EXISTS ishdasiz_open_account ON public.%I',tbl);
    EXECUTE format('CREATE POLICY ishdasiz_open_account ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(public.ishdasiz_account_open(user_id))',tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_guard_closed_password()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.closed_at IS NOT NULL AND NEW.closed_at IS NOT NULL AND NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    RAISE EXCEPTION 'Restore account before changing password' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ishdasiz_guard_closed_password ON public.users;
CREATE TRIGGER ishdasiz_guard_closed_password BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_guard_closed_password();

-- Serialize publication/profile/session writes against close/restore. A stale bot
-- cannot reattach a revoked session, including after the account is restored.
CREATE OR REPLACE FUNCTION public.ishdasiz_guard_closed_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner_id uuid; account_closed timestamptz; epoch integer; row_data jsonb;
BEGIN
  row_data := to_jsonb(NEW);
  IF TG_TABLE_NAME='jobs' THEN
    owner_id := public.ishdasiz_job_owner((row_data->>'employer_id')::uuid,(row_data->>'user_id')::uuid,(row_data->>'created_by')::uuid);
  ELSE owner_id := (row_data->>'user_id')::uuid; END IF;
  IF owner_id IS NULL THEN RETURN NEW; END IF;
  SELECT closed_at,session_version INTO account_closed,epoch FROM public.users WHERE id=owner_id FOR UPDATE;
  IF NOT FOUND OR account_closed IS NOT NULL THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='telegram_sessions' AND COALESCE((row_data->'data'->>'account_session_version')::integer,0) <> epoch THEN
    RAISE EXCEPTION 'Session revoked' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['jobs','resumes','job_seeker_profiles','employer_profiles','telegram_sessions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ishdasiz_guard_closed_account ON public.%I',tbl);
    EXECUTE format('CREATE TRIGGER ishdasiz_guard_closed_account BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_guard_closed_account()',tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_set_account_closed(p_user_id uuid, p_expected_version integer, p_close boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE account_row public.users%ROWTYPE; next_epoch integer;
BEGIN
  SELECT * INTO account_row FROM public.users WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR account_row.session_version <> p_expected_version OR p_close IS NULL
     OR (account_row.closed_at IS NOT NULL) = p_close THEN
    RAISE EXCEPTION 'Account state changed' USING ERRCODE='40001';
  END IF;
  next_epoch := account_row.session_version+1;
  IF p_close THEN
    INSERT INTO public.account_publication_snapshots(user_id,session_version,table_name,item_id,publication)
      SELECT p_user_id,next_epoch,'jobs',j.id,jsonb_build_object('is_active',j.is_active,'status',j.status)
      FROM public.jobs j WHERE public.ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by)=p_user_id;
    INSERT INTO public.account_publication_snapshots(user_id,session_version,table_name,item_id,publication)
      SELECT p_user_id,next_epoch,'resumes',r.id,jsonb_build_object('is_public',r.is_public,'status',r.status)
      FROM public.resumes r WHERE r.user_id=p_user_id;
    UPDATE public.jobs j SET is_active=false,status='archived'
      WHERE public.ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by)=p_user_id;
    UPDATE public.resumes SET is_public=false,status='archived' WHERE user_id=p_user_id;
    UPDATE public.users SET closed_at=clock_timestamp(),session_version=next_epoch WHERE id=p_user_id;
  ELSE
    UPDATE public.users SET closed_at=NULL,session_version=next_epoch WHERE id=p_user_id;
    UPDATE public.jobs j SET is_active=(s.publication->>'is_active')::boolean,status=s.publication->>'status'
      FROM public.account_publication_snapshots s WHERE s.user_id=p_user_id AND s.session_version=p_expected_version
        AND s.table_name='jobs' AND j.id=s.item_id AND j.is_active=false AND j.status='archived'
        AND public.ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by)=p_user_id;
    UPDATE public.resumes r SET is_public=(s.publication->>'is_public')::boolean,status=s.publication->>'status'
      FROM public.account_publication_snapshots s WHERE s.user_id=p_user_id AND s.session_version=p_expected_version
        AND s.table_name='resumes' AND r.id=s.item_id AND r.is_public=false AND r.status='archived' AND r.user_id=p_user_id;
    DELETE FROM public.account_publication_snapshots WHERE user_id=p_user_id AND session_version=p_expected_version;
  END IF;
  UPDATE public.telegram_sessions SET user_id=NULL,state='awaiting_phone',data='{}'::jsonb,
    phone=NULL,otp_code=NULL,otp_expires_at=NULL WHERE user_id=p_user_id OR phone=account_row.phone;
  UPDATE public.otp_codes SET verified=true WHERE phone=account_row.phone AND verified=false;
  RETURN next_epoch;
END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_set_account_closed(uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_set_account_closed(uuid,integer,boolean) TO service_role;
COMMIT;
