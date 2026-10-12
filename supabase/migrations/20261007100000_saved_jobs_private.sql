-- Requires 20261007090000_account_closure.sql. Preserves all existing bookmarks/history.
BEGIN;
CREATE TABLE IF NOT EXISTS public.history_clear_batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),restored_at timestamptz);
ALTER TABLE public.view_history ADD COLUMN IF NOT EXISTS hidden_batch_id uuid REFERENCES public.history_clear_batches(id);
CREATE INDEX IF NOT EXISTS history_clear_batches_user_date ON public.history_clear_batches(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS view_history_user_visible_date ON public.view_history(user_id,viewed_at DESC,id DESC) WHERE hidden_batch_id IS NULL;
DO $$ DECLARE tbl text; col text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['favorites','view_history','history_clear_batches'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE ALL(%I) ON public.%I FROM PUBLIC,anon,authenticated',col,tbl);
  END LOOP;
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tbl);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_set_job_favorite(p_user_id uuid,p_session_version integer,p_job_id uuid,p_favorite boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account_row public.users%ROWTYPE; job_row public.jobs%ROWTYPE; owner_id uuid;
BEGIN
 SELECT * INTO account_row FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR p_session_version IS NULL OR p_favorite IS NULL OR account_row.closed_at IS NOT NULL OR account_row.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 IF NOT p_favorite THEN DELETE FROM public.favorites WHERE user_id=p_user_id AND job_id=p_job_id; RETURN false; END IF;
 SELECT * INTO job_row FROM public.jobs WHERE id=p_job_id;
 IF NOT FOUND OR job_row.is_active IS DISTINCT FROM true OR (job_row.status IS NOT NULL AND job_row.status NOT IN ('active','published','open')) OR COALESCE(to_jsonb(job_row)->>'source_status','') IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed') THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002'; END IF;
 owner_id:=public.ishdasiz_job_owner(job_row.employer_id,job_row.user_id,job_row.created_by);
 IF NOT public.ishdasiz_account_open(owner_id) OR (job_row.employer_id IS NOT NULL AND owner_id IS NULL) THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002'; END IF;
 INSERT INTO public.favorites(user_id,job_id) VALUES(p_user_id,p_job_id) ON CONFLICT(user_id,job_id) DO NOTHING;RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_record_job_view(p_user_id uuid,p_session_version integer,p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account_row public.users%ROWTYPE; job_row public.jobs%ROWTYPE; owner_id uuid;
BEGIN
 SELECT * INTO account_row FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR p_session_version IS NULL OR account_row.closed_at IS NOT NULL OR account_row.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO job_row FROM public.jobs WHERE id=p_job_id;
 IF NOT FOUND OR job_row.is_active IS DISTINCT FROM true OR (job_row.status IS NOT NULL AND job_row.status NOT IN ('active','published','open')) OR COALESCE(to_jsonb(job_row)->>'source_status','') IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed') THEN RETURN false; END IF;
 owner_id:=public.ishdasiz_job_owner(job_row.employer_id,job_row.user_id,job_row.created_by);
 IF NOT public.ishdasiz_account_open(owner_id) OR (job_row.employer_id IS NOT NULL AND owner_id IS NULL) THEN RETURN false; END IF;
 INSERT INTO public.view_history(user_id,job_id,viewed_at,hidden_batch_id) VALUES(p_user_id,p_job_id,clock_timestamp(),NULL)
 ON CONFLICT(user_id,job_id) DO UPDATE SET viewed_at=EXCLUDED.viewed_at,hidden_batch_id=NULL;
 RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_clear_job_history(p_user_id uuid,p_session_version integer,p_restore_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account_row public.users%ROWTYPE; batch_id uuid; latest public.history_clear_batches%ROWTYPE;
BEGIN
 SELECT * INTO account_row FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR p_session_version IS NULL OR account_row.closed_at IS NOT NULL OR account_row.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501'; END IF;
 IF p_restore_id IS NULL THEN
  INSERT INTO public.history_clear_batches(user_id) VALUES(p_user_id) RETURNING id INTO batch_id;
  UPDATE public.view_history SET hidden_batch_id=batch_id WHERE user_id=p_user_id AND hidden_batch_id IS NULL;
 ELSE
  -- Previously hidden batches remain recoverable after undoing the newest one.
  SELECT * INTO latest FROM public.history_clear_batches WHERE user_id=p_user_id AND restored_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND OR latest.id<>p_restore_id THEN
   IF EXISTS(SELECT 1 FROM public.history_clear_batches WHERE id=p_restore_id AND user_id=p_user_id AND restored_at IS NOT NULL) THEN RETURN p_restore_id; END IF;
   RAISE EXCEPTION 'History changed' USING ERRCODE='40001';
  END IF;
  IF latest.restored_at IS NULL THEN
   UPDATE public.view_history SET hidden_batch_id=NULL WHERE user_id=p_user_id AND hidden_batch_id=p_restore_id;
   UPDATE public.history_clear_batches SET restored_at=clock_timestamp() WHERE id=p_restore_id AND user_id=p_user_id;
  END IF;
  batch_id:=p_restore_id;
 END IF;
 RETURN batch_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_record_job_view(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ishdasiz_set_job_favorite(uuid,integer,uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ishdasiz_clear_job_history(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_record_job_view(uuid,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ishdasiz_set_job_favorite(uuid,integer,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ishdasiz_clear_job_history(uuid,integer,uuid) TO service_role;
COMMIT;
