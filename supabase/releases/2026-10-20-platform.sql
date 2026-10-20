-- ISHDASIZ: catalogue indexes and durable OsonIsh queue improvements.
-- Apply in the Supabase SQL Editor as postgres after the existing October release.

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

-- Keep the existing complete enumeration, seven-day historical rechecks and lease fencing.
BEGIN;
CREATE INDEX IF NOT EXISTS ishdasiz_import_summary_idx ON public.source_import_items(run_id) INCLUDE(state,verified,available_at);
CREATE INDEX IF NOT EXISTS ishdasiz_source_candidates_idx ON public.jobs(source_id) INCLUDE(source_status,last_checked_at) WHERE source='osonish' AND is_imported=true;
CREATE OR REPLACE FUNCTION public.ishdasiz_import_summary(p_run_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(c.archived_progress,jsonb_build_object('id',r.id,'state',r.state,'phase',c.phase,'started_at',r.started_at,'completed_at',r.completed_at,
  'total',c.total,'listed',stats.listed,'processed',stats.processed,'failed',stats.failed,'verified',stats.verified,
  'new_imported',c.created_count,'updated',c.updated_count,'skipped_closed',c.skipped_closed,'next_page',c.next_page,'verify_page',c.verify_page,
  'last_error',c.last_error,'next_retry_at',stats.next_retry_at,'busy',r.state='running' AND r.lease_until>clock_timestamp()))
 FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id
 LEFT JOIN LATERAL (
  SELECT count(*) AS listed,count(*) FILTER(WHERE state IN ('active','filled','removed')) AS processed,
   count(*) FILTER(WHERE state='error') AS failed,count(*) FILTER(WHERE verified) AS verified,
   min(available_at) FILTER(WHERE state='pending') AS next_retry_at
  FROM public.source_import_items WHERE run_id=r.id AND c.archived_progress IS NULL
 ) stats ON true WHERE r.id=p_run_id;
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_candidates(p_run_id uuid,p_token uuid,p_page integer,p_ids text[],p_total integer,p_last_page integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;c public.source_import_checkpoints%ROWTYPE;n integer;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 SELECT * INTO c FROM public.source_import_checkpoints WHERE run_id=run.id FOR UPDATE;
 IF NOT FOUND OR c.protocol_version<>2 OR c.phase<>'list' OR p_page IS DISTINCT FROM c.next_page THEN
  RAISE EXCEPTION 'Import page changed' USING ERRCODE='40001';
 END IF;
 IF p_ids IS NULL OR cardinality(p_ids)>100 OR p_total IS NULL OR p_total NOT BETWEEN 0 AND 100000
  OR p_last_page IS NULL OR p_last_page NOT BETWEEN 1 AND c.max_pages OR p_page>c.max_pages
  OR (p_total=0 AND (p_last_page<>1 OR cardinality(p_ids)<>0))
  OR (cardinality(p_ids)=0 AND p_page<p_last_page)
  OR cardinality(p_ids)<>(SELECT count(DISTINCT value) FROM unnest(p_ids) value)
  OR EXISTS(SELECT 1 FROM unnest(p_ids) value WHERE value IS NULL OR CASE WHEN value ~ '^[1-9][0-9]{0,15}$' THEN value::numeric>9007199254740991 ELSE true END) THEN
  RAISE EXCEPTION 'Invalid source page' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.source_import_items(run_id,source_id) SELECT run.id,value FROM unnest(p_ids) value ON CONFLICT DO NOTHING;
 IF p_page>=p_last_page THEN
  -- Include stale imports missing from today's list. Each is checked explicitly;
  -- jobs added after this checkpoint are outside this run and remain untouched.
  INSERT INTO public.source_import_items(run_id,source_id)
   SELECT run.id,source_id FROM public.jobs WHERE source='osonish' AND is_imported=true
    AND (COALESCE(source_status,'') NOT IN ('filled','removed_at_source') OR last_checked_at IS NULL OR last_checked_at<clock_timestamp()-interval '7 days')
    AND NOT EXISTS(SELECT 1 FROM public.source_import_items queued WHERE queued.run_id=run.id AND queued.source_id=jobs.source_id)
    AND CASE WHEN source_id ~ '^[1-9][0-9]{0,15}$' THEN source_id::numeric<=9007199254740991 ELSE false END
   ON CONFLICT DO NOTHING;
 END IF;
 SELECT count(*) INTO n FROM public.source_import_items WHERE run_id=run.id;
 IF n>100000 THEN RAISE EXCEPTION 'Too many source candidates' USING ERRCODE='22023';END IF;
 UPDATE public.source_import_checkpoints SET total=CASE WHEN p_page>=p_last_page THEN n ELSE null END,
  last_page=p_last_page,next_page=p_page+1,consecutive_errors=0,last_error=null,
  phase=CASE WHEN p_page>=p_last_page THEN CASE WHEN n=0 THEN 'verify' ELSE 'details' END ELSE 'list' END WHERE run_id=run.id;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_work(p_run_id uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),
  'batch_supported',true,'protocol_version',(SELECT protocol_version FROM public.source_import_checkpoints WHERE run_id=run.id),
  'ids',COALESCE((SELECT jsonb_agg(source_id ORDER BY source_id) FROM
   (SELECT source_id FROM public.source_import_items WHERE run_id=run.id AND state='pending' AND available_at<=clock_timestamp() ORDER BY source_id LIMIT 50) batch),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_refresh_batch(p_run_id uuid,p_token uuid,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item jsonb;progress jsonb;
BEGIN
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 5 THEN
  RAISE EXCEPTION 'Invalid import batch' USING ERRCODE='22023';END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_items))<>jsonb_array_length(p_items) THEN
  RAISE EXCEPTION 'Duplicate import item' USING ERRCODE='22023';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  progress:=public.ishdasiz_osonish_refresh_item(p_run_id,p_token,item->>'id',item->>'state',nullif(item->'payload','null'::jsonb));
 END LOOP;
 RETURN progress;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_osonish_refresh_batch(uuid,uuid,jsonb),public.ishdasiz_osonish_candidates(uuid,uuid,integer,text[],integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_osonish_refresh_batch(uuid,uuid,jsonb),public.ishdasiz_osonish_candidates(uuid,uuid,integer,text[],integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
