BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_catalog_mode(p_mode text,p_format text,p_employment text,p_source jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE item jsonb; mode text;
BEGIN
 IF jsonb_typeof(p_source->'work_type')='number' THEN
  RETURN CASE p_source->>'work_type' WHEN '1' THEN 'onsite' WHEN '2' THEN 'onsite' WHEN '3' THEN 'remote' WHEN '4' THEN 'hybrid' WHEN '5' THEN 'home' WHEN '6' THEN 'onsite' ELSE null END;
 END IF;
 FOREACH item IN ARRAY ARRAY[to_jsonb(p_mode),to_jsonb(p_format),p_source->'work_mode',p_source->'work_format',p_source->'workplace_type'] LOOP
  mode:=public.ishdasiz_work_mode_text(item);
  IF mode IS NULL OR mode=ANY(ARRAY['','0','all','any','ahamiyatsiz','ahamiyatga ega emas','не важно']) THEN CONTINUE; END IF;
  RETURN CASE
   WHEN mode=ANY(ARRAY['1','onsite','on site','office','in office','на месте','в офисе','офис','ish joyida']) THEN 'onsite'
   WHEN mode=ANY(ARRAY['2','home','work from home','working from home','работа из дома','uydan ishlash']) THEN 'home'
   WHEN mode=ANY(ARRAY['3','remote','remote work','fully remote','remotely','masofaviy','masofadan','masofadan ishlash','удаленная','удаленный','удаленно','удаленная работа','дистанционная','дистанционно']) THEN 'remote'
   WHEN mode=ANY(ARRAY['4','hybrid','gibrid','гибрид','гибридный','гибридная','гибрид (офис + удаленно)','gibrid (ish joyi + masofaviy)']) THEN 'hybrid'
   ELSE null END;
 END LOOP;
 RETURN CASE WHEN public.ishdasiz_work_mode_text(to_jsonb(p_employment))='remote' THEN 'remote' ELSE null END;
END $$;
DO $install$
DECLARE format_expr text;
BEGIN
 format_expr:=CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='work_format') THEN 'work_format::text' ELSE 'NULL::text' END;
 -- No SET clause or whole-row JSON: PostgreSQL can inline the wrapper and use the index.
 EXECUTE 'CREATE OR REPLACE FUNCTION public.ishdasiz_job_work_mode(public.jobs) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER AS ' || quote_literal('SELECT public.ishdasiz_catalog_mode($1.work_mode::text,' || CASE WHEN format_expr='NULL::text' THEN format_expr ELSE '$1.'||format_expr END || ',$1.employment_type::text,$1.raw_source_json)');
 EXECUTE 'CREATE INDEX IF NOT EXISTS ishdasiz_catalog_mode_idx ON public.jobs (public.ishdasiz_catalog_mode(work_mode::text,'||format_expr||',employment_type::text,raw_source_json)) WHERE is_active=true';
END $install$;
CREATE INDEX IF NOT EXISTS ishdasiz_catalog_region_latest_idx ON public.jobs(region_id,created_at DESC,id DESC) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS ishdasiz_catalog_district_latest_idx ON public.jobs(district_id,created_at DESC,id DESC) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS ishdasiz_catalog_category_latest_idx ON public.jobs(category_id,created_at DESC,id DESC) WHERE is_active=true;
REVOKE ALL ON FUNCTION public.ishdasiz_catalog_mode(text,text,text,jsonb),public.ishdasiz_job_work_mode(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_catalog_mode(text,text,text,jsonb),public.ishdasiz_job_work_mode(public.jobs) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_catalog_version() RETURNS integer LANGUAGE sql IMMUTABLE SECURITY INVOKER AS $$ SELECT 2 $$;
REVOKE ALL ON FUNCTION public.ishdasiz_catalog_version() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_catalog_version() TO service_role;
ANALYZE public.jobs;
NOTIFY pgrst,'reload schema';
COMMIT;
