-- Let PostgreSQL plan public scalar predicates directly. Private owner lookups
-- remain inside the existing restricted SECURITY DEFINER helpers.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_available(public.jobs)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
RETURN $1.is_active IS TRUE
 AND ($1.status IS NULL OR $1.status IN ('active','published','open'))
 AND COALESCE($1.source_status,'') NOT IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed')
 AND CASE WHEN $1.employer_id IS NOT NULL THEN
   public.ishdasiz_job_owner($1.employer_id,$1.user_id,$1.created_by) IS NOT NULL
   AND public.ishdasiz_account_open(public.ishdasiz_job_owner($1.employer_id,$1.user_id,$1.created_by))
  ELSE CASE WHEN COALESCE($1.user_id,$1.created_by) IS NULL THEN true
   ELSE public.ishdasiz_account_open(COALESCE($1.user_id,$1.created_by)) END
  END;
REVOKE ALL ON FUNCTION public.ishdasiz_job_available(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_available(public.jobs) TO anon,authenticated,service_role;
DROP POLICY IF EXISTS ishdasiz_open_account ON public.jobs;
CREATE POLICY ishdasiz_open_account ON public.jobs AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(CASE WHEN employer_id IS NULL AND COALESCE(user_id,created_by) IS NULL THEN true
  ELSE public.ishdasiz_account_open(public.ishdasiz_job_owner(employer_id,user_id,created_by)) END);
NOTIFY pgrst,'reload schema';
COMMIT;
