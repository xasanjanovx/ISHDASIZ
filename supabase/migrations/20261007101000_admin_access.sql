-- Apply with the completed admin API/UI release, after account_closure and vacancy_updated_at.
-- No profiles, vacancies, applications or authentication accounts are deleted.
BEGIN;
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_profile_clock() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond');ELSE NEW.updated_at:=OLD.updated_at;END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ishdasiz_admin_profile_clock ON public.admin_profiles;
CREATE TRIGGER ishdasiz_admin_profile_clock BEFORE UPDATE ON public.admin_profiles FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_admin_profile_clock();
CREATE TABLE IF NOT EXISTS public.admin_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_id uuid NOT NULL REFERENCES public.admin_profiles(id),job_id uuid NOT NULL REFERENCES public.jobs(id),action text NOT NULL CHECK(action IN ('create','edit','publish','hide','filled','archive','restore')),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),previous_version timestamptz,result_version timestamptz);
CREATE INDEX IF NOT EXISTS admin_actions_job_date ON public.admin_actions(job_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.admin_vacancy_ai_usage(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_id uuid NOT NULL REFERENCES public.admin_profiles(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX IF NOT EXISTS admin_vacancy_ai_usage_actor_date ON public.admin_vacancy_ai_usage(admin_id,created_at);
DO $$ DECLARE tbl text;col text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['admin_profiles','admin_actions','admin_vacancy_ai_usage'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP EXECUTE format('REVOKE ALL(%I) ON public.%I FROM PUBLIC,anon,authenticated',col,tbl);END LOOP;
 END LOOP;
END $$;
GRANT ALL ON public.admin_profiles TO service_role;
REVOKE ALL ON public.admin_actions,public.admin_vacancy_ai_usage FROM service_role;
GRANT SELECT ON public.admin_actions,public.admin_vacancy_ai_usage TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_write_vacancy(p_admin_id uuid,p_job_id uuid,p_action text,p_payload jsonb,p_expected_version timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.admin_profiles%ROWTYPE; job_row public.jobs%ROWTYPE; old_version timestamptz;body jsonb; columns_sql text;assignments text;col text;allowed text[];
BEGIN
 SELECT * INTO actor FROM public.admin_profiles WHERE id=p_admin_id FOR UPDATE;
 IF NOT FOUND OR actor.disabled_at IS NOT NULL OR actor.role IS NULL OR actor.role NOT IN ('super_admin','hokimlik_assistant') OR (actor.role='hokimlik_assistant' AND (actor.district_id IS NULL OR actor.district_id<1)) THEN RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';END IF;
 IF p_job_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','edit','publish','hide','filled','archive','restore') OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023';END IF;
 allowed:=ARRAY['title_uz','title_ru','description_uz','description_ru','company_name','category_id','region_id','district_id','salary_min','salary_max','employment_type','latitude','longitude','address','contact_phone','contact_telegram','requirements_uz','requirements_ru','benefits','experience','education_level','gender','age_min','age_max','languages','skills','is_for_students','is_for_disabled','is_for_women','payment_type','work_mode','status','is_active'];
 FOR col IN SELECT jsonb_object_keys(p_payload) LOOP IF NOT col=ANY(allowed) OR (p_action<>'create' AND col IN ('status','is_active')) THEN RAISE EXCEPTION 'Invalid field' USING ERRCODE='22023';END IF;END LOOP;
 IF actor.role='hokimlik_assistant' AND p_action IN ('create','edit','publish') AND (p_payload->>'district_id')::integer IS DISTINCT FROM actor.district_id THEN RAISE EXCEPTION 'District unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO job_row FROM public.jobs WHERE id=p_job_id FOR UPDATE;
 IF FOUND THEN
  IF actor.role='hokimlik_assistant' AND job_row.district_id IS DISTINCT FROM actor.district_id THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002';END IF;
  IF p_action='create' THEN
   IF NOT EXISTS(SELECT 1 FROM public.admin_actions WHERE job_id=p_job_id AND admin_id=p_admin_id AND action='create') OR EXISTS(SELECT 1 FROM jsonb_each(p_payload) AS e WHERE to_jsonb(job_row)->e.key IS DISTINCT FROM e.value) THEN RAISE EXCEPTION 'Vacancy changed' USING ERRCODE='40001';END IF;
   RETURN to_jsonb(job_row);
  END IF;
 ELSE
  IF p_action<>'create' THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002';END IF;
 END IF;
 IF p_action='create' THEN
  IF p_payload->>'status' IS NULL OR p_payload->>'status' NOT IN ('active','draft') THEN RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';END IF;
  body:=p_payload||jsonb_build_object('id',p_job_id,'status',p_payload->>'status','is_active',p_payload->>'status'='active','employer_id',null,'user_id',null,'created_by',null,'is_imported',false,'source','local','created_at',clock_timestamp(),'updated_at',clock_timestamp());
  SELECT string_agg(format('%I',key),',' ORDER BY key) INTO columns_sql FROM jsonb_object_keys(body) AS key;
  EXECUTE format('INSERT INTO public.jobs(%s) SELECT %s FROM jsonb_populate_record(NULL::public.jobs,$1) RETURNING *',columns_sql,columns_sql) INTO job_row USING body;
 ELSE
  IF job_row.updated_at IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Vacancy changed' USING ERRCODE='40001';END IF;
  IF (job_row.status='archived' AND p_action<>'restore') OR (job_row.status IS DISTINCT FROM 'archived' AND p_action='restore') THEN RAISE EXCEPTION 'Status changed' USING ERRCODE='40001';END IF;
  old_version:=job_row.updated_at;body:=p_payload;
  IF p_action='publish' THEN
   IF COALESCE(to_jsonb(job_row)->>'source_status','') IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed') THEN RAISE EXCEPTION 'Source unavailable' USING ERRCODE='40001';END IF;
   body:=body||jsonb_build_object('status','active','is_active',true);
  ELSIF p_action<>'edit' THEN body:=jsonb_build_object('status',CASE WHEN p_action='archive' THEN 'archived' WHEN p_action='filled' THEN 'filled' ELSE 'draft' END,'is_active',false);END IF;
  body:=body||jsonb_build_object('updated_at',clock_timestamp());
  SELECT string_agg(format('%I=source.%I',key,key),',' ORDER BY key) INTO assignments FROM jsonb_object_keys(body) AS key;
  EXECUTE format('UPDATE public.jobs AS target SET %s FROM jsonb_populate_record(NULL::public.jobs,$1) AS source WHERE target.id=$2 RETURNING target.*',assignments) INTO job_row USING body,p_job_id;
 END IF;
 INSERT INTO public.admin_actions(admin_id,job_id,action,previous_version,result_version) VALUES(p_admin_id,p_job_id,p_action,old_version,job_row.updated_at);
 RETURN to_jsonb(job_row);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_admin_write_vacancy(uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_admin_write_vacancy(uuid,uuid,text,jsonb,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_reserve_admin_vacancy_ai(p_admin_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.admin_profiles%ROWTYPE;used integer;
BEGIN
 SELECT * INTO actor FROM public.admin_profiles WHERE id=p_admin_id FOR UPDATE;
 IF NOT FOUND OR actor.disabled_at IS NOT NULL OR actor.role IS NULL OR actor.role NOT IN ('super_admin','hokimlik_assistant') OR (actor.role='hokimlik_assistant' AND (actor.district_id IS NULL OR actor.district_id<1)) THEN RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';END IF;
 SELECT count(*) INTO used FROM public.admin_vacancy_ai_usage WHERE admin_id=p_admin_id AND created_at>clock_timestamp()-interval '1 hour';
 IF used>=3 THEN RETURN -1;END IF;
 INSERT INTO public.admin_vacancy_ai_usage(admin_id) VALUES(p_admin_id);RETURN 2-used;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_reserve_admin_vacancy_ai(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_reserve_admin_vacancy_ai(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_stats(p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.admin_profiles%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.admin_profiles WHERE id=p_admin_id FOR SHARE;
 IF NOT FOUND OR actor.disabled_at IS NOT NULL OR actor.role IS NULL OR actor.role NOT IN ('super_admin','hokimlik_assistant')
    OR (actor.role='hokimlik_assistant' AND (actor.district_id IS NULL OR actor.district_id<1)) THEN
  RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';
 END IF;
 WITH scoped AS MATERIALIZED (
  SELECT j.* FROM public.jobs j WHERE actor.role='super_admin' OR j.district_id=actor.district_id
 ), category_groups AS (
  SELECT j.category_id AS id,c.name_uz,c.name_ru,count(*) AS count
  FROM scoped j LEFT JOIN public.categories c ON c.id=j.category_id
  GROUP BY j.category_id,c.name_uz,c.name_ru
 ), district_groups AS (
  SELECT j.district_id AS id,d.name_uz,d.name_ru,count(*) AS count
  FROM scoped j LEFT JOIN public.districts d ON d.id=j.district_id
  GROUP BY j.district_id,d.name_uz,d.name_ru
 ), type_groups AS (
  SELECT employment_type AS type,count(*) AS count FROM scoped GROUP BY employment_type
 )
 SELECT jsonb_build_object(
  'totalJobs',count(*),
  'activeJobs',count(*) FILTER(WHERE j.is_active IS TRUE AND (j.status IS NULL OR j.status IN ('active','published','open'))
    AND COALESCE(j.source_status,'') NOT IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed')
    AND public.ishdasiz_account_open(public.ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by))),
  'hiddenJobs',count(*) FILTER(WHERE j.is_active IS NOT TRUE),
  'removedJobs',count(*) FILTER(WHERE j.source_status='removed_at_source'),
  'totalViews',COALESCE(sum(greatest(COALESCE(j.views_count,0),0)),0),
  'totalApplications',(SELECT count(*) FROM public.job_applications a JOIN scoped s ON s.id=a.job_id),
  'jobsByCategory',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY count DESC,id) FROM category_groups g),'[]'::jsonb),
  'jobsByDistrict',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY count DESC,id) FROM district_groups g),'[]'::jsonb),
  'jobsByType',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY count DESC,type) FROM type_groups g),'[]'::jsonb)
 ) INTO result FROM scoped j;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_admin_stats(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_admin_stats(uuid) TO service_role;
COMMIT;
