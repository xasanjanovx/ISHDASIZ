-- Imported ownerless vacancies need no private-table lookup. Return early
-- before SQL planning; the small Supabase instance enforces a 3-second limit.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_account_open(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_user_id IS NULL THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id AND closed_at IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_account_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_account_open(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_owner(p_employer uuid,p_user uuid,p_creator uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid;
BEGIN
 IF p_employer IS NULL THEN RETURN COALESCE(p_user,p_creator); END IF;
 SELECT user_id INTO owner_id FROM public.employer_profiles WHERE id=p_employer;
 RETURN owner_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_job_owner(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_owner(uuid,uuid,uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_available(public.jobs)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE vacancy ALIAS FOR $1; owner_id uuid; account_closed timestamptz;
BEGIN
 IF vacancy.is_active IS NOT TRUE
    OR (vacancy.status IS NOT NULL AND vacancy.status NOT IN ('active','published','open'))
    OR COALESCE(vacancy.source_status,'') IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed') THEN
  RETURN false;
 END IF;
 IF vacancy.employer_id IS NOT NULL THEN
  SELECT u.closed_at INTO account_closed FROM public.employer_profiles e
   JOIN public.users u ON u.id=e.user_id WHERE e.id=vacancy.employer_id;
  RETURN FOUND AND account_closed IS NULL;
 END IF;
 owner_id:=COALESCE(vacancy.user_id,vacancy.created_by);
 IF owner_id IS NULL THEN RETURN true; END IF;
 SELECT u.closed_at INTO account_closed FROM public.users u WHERE u.id=owner_id;
 RETURN FOUND AND account_closed IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_job_available(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_available(public.jobs) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
