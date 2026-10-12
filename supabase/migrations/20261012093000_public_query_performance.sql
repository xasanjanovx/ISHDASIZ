-- Preserve publication/account visibility while avoiding whole-row JSON and
-- nested SECURITY DEFINER calls for every vacancy in public aggregates.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_available(public.jobs)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT $1.is_active IS TRUE
  AND ($1.status IS NULL OR $1.status IN ('active','published','open'))
  AND COALESCE($1.source_status,'') NOT IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed')
  AND CASE WHEN $1.employer_id IS NOT NULL THEN
    EXISTS(SELECT 1 FROM public.employer_profiles e JOIN public.users u ON u.id=e.user_id
      WHERE e.id=$1.employer_id AND u.closed_at IS NULL)
   ELSE COALESCE($1.user_id,$1.created_by) IS NULL OR
    EXISTS(SELECT 1 FROM public.users u WHERE u.id=COALESCE($1.user_id,$1.created_by) AND u.closed_at IS NULL)
   END;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_job_available(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_available(public.jobs) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
