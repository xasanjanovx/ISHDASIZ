-- One public aggregate scan replaces the homepage's parallel count queries.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_public_home_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH visible AS MATERIALIZED (
  SELECT category_id,
   (is_for_students IS TRUE OR is_for_graduates IS TRUE) students,
   is_for_disabled IS TRUE disabled,
   (is_for_women IS TRUE OR gender IS NULL OR gender::text IN ('female','2','any','3')) women
  FROM public.jobs j WHERE public.ishdasiz_job_available(j)
 ), categories AS (SELECT category_id,count(*) n FROM visible WHERE category_id IS NOT NULL GROUP BY category_id),
 totals AS (SELECT count(*) total,count(*) FILTER(WHERE students) students,
  count(*) FILTER(WHERE disabled) disabled,count(*) FILTER(WHERE women) women FROM visible)
 SELECT jsonb_build_object('total',t.total,
  'categories',COALESCE((SELECT jsonb_object_agg(category_id::text,n) FROM categories),'{}'::jsonb),
  'special',jsonb_build_object('students',t.students,'disabled',t.disabled,'women',t.women)) FROM totals t;
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_public_home_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_public_home_counts() TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
