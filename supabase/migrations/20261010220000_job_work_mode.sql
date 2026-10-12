BEGIN;
-- Pure computed field: canonical and imported values share the same filters.
CREATE OR REPLACE FUNCTION public.ishdasiz_work_mode_text(jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN jsonb_typeof($1) IN ('string','number') THEN
  regexp_replace(translate(replace(lower(btrim($1#>>'{}')),'ё','е'),'-_‘’ʻʼ`''','  '),'[[:space:]]+',' ','g')
 ELSE '' END;
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_job_work_mode(public.jobs)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE row_data jsonb=to_jsonb($1); value jsonb; mode text;
BEGIN
 FOREACH value IN ARRAY ARRAY[row_data->'work_mode',row_data->'work_format',row_data#>'{raw_source_json,work_mode}',row_data#>'{raw_source_json,work_format}',row_data#>'{raw_source_json,workplace_type}'] LOOP
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
 IF public.ishdasiz_work_mode_text(row_data->'employment_type')='remote' THEN RETURN 'remote'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_work_mode_text(jsonb),public.ishdasiz_job_work_mode(public.jobs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ishdasiz_work_mode_text(jsonb),public.ishdasiz_job_work_mode(public.jobs) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
