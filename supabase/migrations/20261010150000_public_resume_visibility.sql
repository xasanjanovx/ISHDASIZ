-- Apply after the October account/resume migrations, with the public catalog.
-- The server search must enforce visibility even when using service_role.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_resume_available(public.resumes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT $1.user_id IS NOT NULL AND $1.is_public IS TRUE AND ($1.status='active') IS TRUE
  AND $1.found_job IS NOT TRUE AND public.ishdasiz_account_open($1.user_id);
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_resume_available(public.resumes) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_resume_available(public.resumes) TO anon,authenticated,service_role;
DROP POLICY IF EXISTS ishdasiz_resume_publication ON public.resumes;
CREATE POLICY ishdasiz_resume_publication ON public.resumes AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.ishdasiz_resume_available(resumes) OR
  (current_user='authenticated' AND user_id=(SELECT auth.uid())));
-- Called by the website server. No table rights or existing policies are expanded.
CREATE OR REPLACE FUNCTION public.ishdasiz_public_resume_search(
  p_query text DEFAULT '', p_category uuid DEFAULT NULL,
  p_region integer DEFAULT NULL, p_district integer DEFAULT NULL,
  p_experience text[] DEFAULT NULL, p_education text DEFAULT NULL, p_gender text DEFAULT NULL,
  p_salary_min integer DEFAULT 0, p_salary_max integer DEFAULT 20000000,
  p_before_created timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 24
) RETURNS TABLE (card jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'title', r.title, 'full_name', r.full_name, 'city', r.city,
    'region_id', r.region_id, 'district_id', r.district_id,
    'experience', r.experience, 'experience_years', r.experience_years,
    'skills', r.skills, 'expected_salary_min', r.expected_salary_min,
    'expected_salary_max', r.expected_salary_max, 'created_at', r.created_at,
    'regions', CASE WHEN reg.id IS NULL THEN NULL ELSE jsonb_build_object('name_uz', reg.name_uz, 'name_ru', reg.name_ru) END,
    'districts', CASE WHEN dist.id IS NULL THEN NULL ELSE jsonb_build_object('name_uz', dist.name_uz, 'name_ru', dist.name_ru) END
  )
  FROM public.resumes r
  LEFT JOIN public.regions reg ON reg.id = r.region_id
  LEFT JOIN public.districts dist ON dist.id = r.district_id
  WHERE r.is_public IS TRUE AND r.status = 'active'
    AND public.ishdasiz_resume_available(r)
    AND (p_category IS NULL OR r.category_id = p_category)
    AND (p_region IS NULL OR r.region_id = p_region)
    AND (p_district IS NULL OR r.district_id = p_district)
    AND (p_experience IS NULL OR (to_jsonb(r)->>'experience') = ANY(p_experience))
    AND (p_education IS NULL OR r.education_level = p_education)
    AND (p_gender IS NULL OR r.gender = p_gender)
    AND (p_salary_min <= 0 OR r.expected_salary_max IS NULL OR r.expected_salary_max >= p_salary_min)
    AND (p_salary_max >= 20000000 OR r.expected_salary_min IS NULL OR r.expected_salary_min <= p_salary_max)
    AND (p_before_created IS NULL OR (r.created_at, r.id) < (p_before_created, p_before_id))
    AND (coalesce(btrim(p_query), '') = '' OR position(lower(btrim(p_query)) IN lower(concat_ws(' ',
      r.title, r.full_name, r.about, (to_jsonb(r)->>'skills')
    ))) > 0)
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT greatest(1, least(coalesce(p_page_size, 24), 50)) + 1;
$$;

REVOKE ALL ON FUNCTION public.ishdasiz_public_resume_search(text,uuid,integer,integer,text[],text,text,integer,integer,timestamptz,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_public_resume_search(text,uuid,integer,integer,text[],text,text,integer,integer,timestamptz,uuid,integer) TO service_role;
CREATE INDEX IF NOT EXISTS resumes_public_catalog_page_idx ON public.resumes(created_at DESC, id DESC) WHERE is_public IS TRUE AND status = 'active';
NOTIFY pgrst, 'reload schema';

NOTIFY pgrst,'reload schema';
COMMIT;
