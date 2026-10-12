-- Apply after public_job_availability, with the public statistics release.
-- Only aggregate counts of currently public vacancies leave this function.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_public_statistics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH visible AS MATERIALIZED (
  SELECT id,region_id,district_id,category_id,GREATEST(COALESCE(views_count,0),0) AS views,
   CASE WHEN employment_type IN ('full_time','part_time','contract','internship','remote') THEN employment_type ELSE NULL END AS employment
  FROM public.jobs j WHERE public.ishdasiz_job_available(j)
 ), region_counts AS (SELECT region_id,count(*) AS n FROM visible GROUP BY region_id),
 category_counts AS (SELECT category_id,count(*) AS n FROM visible GROUP BY category_id),
 district_counts AS (SELECT district_id,count(*) AS n FROM visible GROUP BY district_id),
 employment_counts AS (SELECT employment,count(*) AS n FROM visible GROUP BY employment)
 SELECT jsonb_build_object(
  'availableJobs',(SELECT count(*) FROM visible),'views',(SELECT COALESCE(sum(views),0) FROM visible),
  'applications',(SELECT count(*) FROM public.job_applications a JOIN visible j ON j.id=a.job_id WHERE public.ishdasiz_account_open(a.user_id)),
  'regionCount',(SELECT count(*) FROM region_counts WHERE region_id IS NOT NULL),
  'byRegion',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.region_id,'name_uz',r.name_uz,'name_ru',r.name_ru,'count',c.n) ORDER BY c.n DESC,c.region_id NULLS LAST) FROM region_counts c LEFT JOIN public.regions r ON r.id=c.region_id),'[]'::jsonb),
  'byCategory',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.category_id,'name_uz',r.name_uz,'name_ru',r.name_ru,'count',c.n) ORDER BY c.n DESC,c.category_id NULLS LAST) FROM category_counts c LEFT JOIN public.categories r ON r.id=c.category_id),'[]'::jsonb),
  'byDistrict',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.district_id,'name_uz',d.name_uz,'name_ru',d.name_ru,'region_uz',r.name_uz,'region_ru',r.name_ru,'count',c.n) ORDER BY c.n DESC,c.district_id NULLS LAST) FROM district_counts c LEFT JOIN public.districts d ON d.id=c.district_id LEFT JOIN public.regions r ON r.id=d.region_id),'[]'::jsonb),
  'byEmployment',COALESCE((SELECT jsonb_agg(jsonb_build_object('type',employment,'count',n) ORDER BY n DESC,employment NULLS LAST) FROM employment_counts),'[]'::jsonb),
  'asOf',statement_timestamp()
 );
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_public_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_public_statistics() TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
