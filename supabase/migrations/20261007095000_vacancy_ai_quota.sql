-- Requires 20261007090000_account_closure.sql. No prompts or personal content are stored.
BEGIN;
CREATE TABLE IF NOT EXISTS public.vacancy_ai_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS vacancy_ai_usage_user_time ON public.vacancy_ai_usage(user_id,created_at);
ALTER TABLE public.vacancy_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vacancy_ai_usage FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.vacancy_ai_usage TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_reserve_vacancy_ai(p_user_id uuid,p_session_version integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account_row public.users%ROWTYPE; used integer;
BEGIN
 SELECT * INTO account_row FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR p_session_version IS NULL OR account_row.closed_at IS NOT NULL OR account_row.session_version<>p_session_version THEN
  RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';
 END IF;
 SELECT count(*) INTO used FROM public.vacancy_ai_usage WHERE user_id=p_user_id AND created_at>clock_timestamp()-interval '1 hour';
 IF used>=3 THEN RETURN -1; END IF;
 INSERT INTO public.vacancy_ai_usage(user_id) VALUES(p_user_id);
 RETURN 2-used;
END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_reserve_vacancy_ai(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_reserve_vacancy_ai(uuid,integer) TO service_role;
COMMIT;
