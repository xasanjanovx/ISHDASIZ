-- Cache normalized work mode during writes so regional exact counts use a plain index.
-- The temporary generated column backfills without application UPDATE events; its
-- stored values are then maintained by the first BEFORE trigger. Existing vacancy
-- content, versions, source state, visibility policies and channel receipts remain intact.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_work_mode_values(p_work_mode text,p_work_format text,p_raw_source_json jsonb,p_employment_type text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=public,pg_temp AS $calc$
DECLARE value jsonb; mode text; field_index integer;
BEGIN
 FOR field_index IN 0..4 LOOP
  value:=CASE field_index WHEN 0 THEN to_jsonb(p_work_mode) WHEN 1 THEN to_jsonb(p_work_format) WHEN 2 THEN p_raw_source_json->'work_mode' WHEN 3 THEN p_raw_source_json->'work_format' ELSE p_raw_source_json->'workplace_type' END;
  IF value IS NULL OR value='null'::jsonb THEN CONTINUE;END IF;
  -- Common canonical values do not need JSON serialization of the vacancy or regexp normalization.
  mode:=value#>>'{}';
  IF mode IN ('1','onsite') THEN RETURN 'onsite';
  ELSIF mode IN ('2','home') THEN RETURN 'home';
  ELSIF mode IN ('3','remote') THEN RETURN 'remote';
  ELSIF mode IN ('4','hybrid') THEN RETURN 'hybrid';END IF;
  mode=public.ishdasiz_work_mode_text(value);
  IF mode IS NULL OR mode=ANY(ARRAY['','0','all','any','ahamiyatsiz','ahamiyatga ega emas','не важно']) THEN CONTINUE; END IF;
  CASE
 WHEN mode=ANY(ARRAY['1','onsite','on site','office','in office','на месте','в офисе','офис','ish joyida']) THEN RETURN 'onsite';
 WHEN mode=ANY(ARRAY['2','home','work from home','working from home','работа из дома','uydan ishlash']) THEN RETURN 'home';
 WHEN mode=ANY(ARRAY['3','remote','remote work','fully remote','remotely','masofaviy','masofadan','masofadan ishlash','удаленная','удаленный','удаленно','удаленная работа','дистанционная','дистанционно']) THEN RETURN 'remote';
 WHEN mode=ANY(ARRAY['4','hybrid','gibrid','гибрид','гибридный','гибридная','гибрид (офис + удаленно)','gibrid (ish joyi + masofaviy)']) THEN RETURN 'hybrid';
   ELSE RETURN NULL;
  END CASE;
 END LOOP;
 IF public.ishdasiz_work_mode_text(to_jsonb(p_employment_type))='remote' THEN RETURN 'remote'; END IF;
 RETURN NULL;
END $calc$;
REVOKE ALL ON FUNCTION public.ishdasiz_work_mode_values(text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_work_mode_values(text,text,jsonb,text) TO anon,authenticated,service_role;
DO $install$
DECLARE field_name text;field_type oid;category "char";expressions text[]:='{}';trigger_expressions text[]:='{}';column_marker text;generation "char";
BEGIN
 FOREACH field_name IN ARRAY ARRAY['work_mode','work_format','employment_type'] LOOP
  SELECT a.atttypid,t.typcategory INTO field_type,category FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid WHERE a.attrelid='public.jobs'::regclass AND a.attname=field_name AND a.attnum>0 AND NOT a.attisdropped;
  IF NOT FOUND THEN
   IF field_name<>'work_format' THEN RAISE EXCEPTION 'Required work-mode input is missing';END IF;
   expressions:=array_append(expressions,'NULL::text');trigger_expressions:=array_append(trigger_expressions,'NULL::text');
  ELSIF field_type IN ('json'::regtype,'jsonb'::regtype) THEN
   expressions:=array_append(expressions,format('CASE WHEN jsonb_typeof(%I::jsonb) IN (''string'',''number'') THEN %I::jsonb#>>''{}'' ELSE NULL::text END',field_name,field_name));
   trigger_expressions:=array_append(trigger_expressions,format('CASE WHEN jsonb_typeof(NEW.%I::jsonb) IN (''string'',''number'') THEN NEW.%I::jsonb#>>''{}'' ELSE NULL::text END',field_name,field_name));
  ELSIF category IN ('S','N') THEN
   expressions:=array_append(expressions,format('%I::text',field_name));trigger_expressions:=array_append(trigger_expressions,format('NEW.%I::text',field_name));
  ELSIF category IN ('B','A','C') THEN
   expressions:=array_append(expressions,'NULL::text');trigger_expressions:=array_append(trigger_expressions,'NULL::text');
  ELSE RAISE EXCEPTION 'Unsupported work-mode input type';END IF;
 END LOOP;
 SELECT col_description(a.attrelid,a.attnum),a.attgenerated INTO column_marker,generation FROM pg_attribute a WHERE a.attrelid='public.jobs'::regclass AND a.attname='ishdasiz_catalog_work_mode' AND a.attnum>0 AND NOT a.attisdropped;
 IF NOT FOUND THEN
  -- DDL backfill does not fire application UPDATE triggers or change their versions/history.
  EXECUTE format('ALTER TABLE public.jobs ADD COLUMN ishdasiz_catalog_work_mode text GENERATED ALWAYS AS (public.ishdasiz_work_mode_values(%s,%s,raw_source_json::jsonb,%s)) STORED',expressions[1],expressions[2],expressions[3]);
  COMMENT ON COLUMN public.jobs.ishdasiz_catalog_work_mode IS 'ISHDASIZ: normalized catalogue work mode v1.';
  ALTER TABLE public.jobs ALTER COLUMN ishdasiz_catalog_work_mode DROP EXPRESSION;
 ELSIF column_marker IS DISTINCT FROM 'ISHDASIZ: normalized catalogue work mode v1.' OR generation<>'' THEN
  RAISE EXCEPTION 'Unexpected existing catalogue work-mode column';
 END IF;
 EXECUTE format($trigger$CREATE OR REPLACE FUNCTION public.ishdasiz_cache_job_work_mode()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $fn$
 BEGIN NEW.ishdasiz_catalog_work_mode:=public.ishdasiz_work_mode_values(%s,%s,NEW.raw_source_json::jsonb,%s);RETURN NEW;END;
 $fn$;$trigger$,trigger_expressions[1],trigger_expressions[2],trigger_expressions[3]);
END $install$;
REVOKE ALL ON FUNCTION public.ishdasiz_cache_job_work_mode() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS a00_ishdasiz_catalog_work_mode ON public.jobs;
CREATE TRIGGER a00_ishdasiz_catalog_work_mode BEFORE INSERT OR UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_cache_job_work_mode();
DO $order$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.jobs'::regclass AND NOT tgisinternal AND (tgtype::integer&2)<>0 AND (tgtype::integer&20)<>0 AND tgname<'a00_ishdasiz_catalog_work_mode') THEN RAISE EXCEPTION 'A preceding BEFORE trigger needs review';END IF;
END $order$;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_work_mode(public.jobs)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER
RETURN $1.ishdasiz_catalog_work_mode;
REVOKE ALL ON FUNCTION public.ishdasiz_job_work_mode(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_work_mode(public.jobs) TO anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS ishdasiz_catalog_mode_idx ON public.jobs(ishdasiz_catalog_work_mode,region_id,district_id)
 INCLUDE(id,employer_id,user_id,created_by,is_active,status,source_status)
 WHERE is_active IS TRUE AND (status IS NULL OR status IN ('active','published','open'))
  AND COALESCE(source_status,'') NOT IN ('filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed');
ANALYZE public.jobs;
NOTIFY pgrst,'reload schema';
COMMIT;
