-- Apply with the site and both bot releases, after account_closure.
-- Publication and source availability are independent; neither is overwritten here.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_available(public.jobs)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT $1.is_active IS TRUE
  AND ($1.status IS NULL OR $1.status IN ('active','published','open'))
  AND COALESCE(to_jsonb($1)->>'source_status','') NOT IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed')
  AND ($1.employer_id IS NULL OR EXISTS(SELECT 1 FROM public.employer_profiles e WHERE e.id=$1.employer_id AND e.user_id IS NOT NULL))
  AND public.ishdasiz_account_open(public.ishdasiz_job_owner($1.employer_id,$1.user_id,$1.created_by));
$$;
-- The unnamed composite argument also allows PostgREST computed-field filters.
REVOKE ALL ON FUNCTION public.ishdasiz_job_available(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_available(public.jobs) TO anon,authenticated,service_role;
DROP POLICY IF EXISTS ishdasiz_job_publication ON public.jobs;
CREATE POLICY ishdasiz_job_publication ON public.jobs AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.ishdasiz_job_available(jobs) OR
  (current_user='authenticated' AND public.ishdasiz_job_owner(employer_id,user_id,created_by)=(SELECT auth.uid())));
-- This restrictive policy never grants access by itself. Existing permissive
-- policies still determine whether an authenticated owner can read their draft.
CREATE OR REPLACE FUNCTION public.ishdasiz_public_job_counts(p_region integer DEFAULT NULL,p_district integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF (p_region IS NOT NULL AND p_region<1) OR (p_district IS NOT NULL AND p_district<1) THEN
  RAISE EXCEPTION 'Invalid location' USING ERRCODE='22023';
 END IF;
 WITH visible AS MATERIALIZED (
  SELECT district_id,category_id FROM public.jobs j WHERE public.ishdasiz_job_available(j)
   AND (p_region IS NULL OR j.region_id=p_region) AND (p_district IS NULL OR j.district_id=p_district)
 ), district_counts AS (SELECT district_id,count(*) AS n FROM visible WHERE district_id IS NOT NULL GROUP BY district_id),
 category_counts AS (SELECT category_id,count(*) AS n FROM visible WHERE category_id IS NOT NULL GROUP BY category_id)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM visible),
  'districts',COALESCE((SELECT jsonb_object_agg(district_id::text,n) FROM district_counts),'{}'::jsonb),
  'categories',COALESCE((SELECT jsonb_object_agg(category_id::text,n) FROM category_counts),'{}'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_public_job_counts(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_public_job_counts(integer,integer) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
