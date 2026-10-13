-- Avoid serializing whole vacancies or normalizing lower-priority fields during regional/remote searches.
BEGIN;
DO $install$
DECLARE legacy_value text;
BEGIN
 legacy_value:=CASE WHEN EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.jobs'::regclass AND attname='work_format' AND attnum>0 AND NOT attisdropped) THEN 'to_jsonb($1.work_format)' ELSE 'NULL::jsonb' END;
 EXECUTE format($body$CREATE OR REPLACE FUNCTION public.ishdasiz_job_work_mode(public.jobs)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE value jsonb; mode text; field_index integer;
BEGIN
 FOR field_index IN 0..4 LOOP
  value:=CASE field_index WHEN 0 THEN to_jsonb($1.work_mode) WHEN 1 THEN %s WHEN 2 THEN $1.raw_source_json->'work_mode' WHEN 3 THEN $1.raw_source_json->'work_format' ELSE $1.raw_source_json->'workplace_type' END;
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
 IF public.ishdasiz_work_mode_text(to_jsonb($1.employment_type))='remote' THEN RETURN 'remote'; END IF;
 RETURN NULL;
END $$;
$body$,legacy_value);
END $install$;
REVOKE ALL ON FUNCTION public.ishdasiz_job_work_mode(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_work_mode(public.jobs) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
