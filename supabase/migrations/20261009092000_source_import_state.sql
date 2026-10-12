-- Apply only with the unified importer and public source-availability guards.
-- Requires account_closure, vacancy_updated_at and admin_access. No data is deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.source_import_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text NOT NULL,actor_id uuid REFERENCES public.admin_profiles(id),
 state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','completed','failed','abandoned')),
 lease_token uuid NOT NULL DEFAULT gen_random_uuid(),lease_until timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,counters jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS source_import_running ON public.source_import_runs(source) WHERE state='running';
CREATE INDEX IF NOT EXISTS source_import_history ON public.source_import_runs(source,started_at DESC);
CREATE TABLE IF NOT EXISTS public.job_import_state(
 job_id uuid PRIMARY KEY REFERENCES public.jobs(id),baseline jsonb NOT NULL DEFAULT '{}',
 overrides text[] NOT NULL DEFAULT '{}',pending jsonb,updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- An uncommitted, exact-row capability for source metadata only. Closing an
-- account still rejects content, ownership and publication changes.
CREATE TABLE IF NOT EXISTS public.source_import_visibility_pending(
 job_id uuid PRIMARY KEY REFERENCES public.jobs(id),run_id uuid NOT NULL REFERENCES public.source_import_runs(id),payload jsonb NOT NULL
);
DO $$ DECLARE tbl text;col text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['source_import_runs','job_import_state','source_import_visibility_pending'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE ALL(%I) ON public.%I FROM PUBLIC,anon,authenticated,service_role',col,tbl);
  END LOOP;
 END LOOP;
END $$;
GRANT SELECT ON public.source_import_runs,public.job_import_state TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_guard_closed_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid;account_closed timestamptz;epoch integer;row_data jsonb;metadata_fields text[]:=ARRAY['source_status','last_seen_at','last_synced_at','last_checked_at'];
BEGIN
 row_data:=to_jsonb(NEW);
 IF TG_TABLE_NAME='jobs' THEN owner_id:=public.ishdasiz_job_owner((row_data->>'employer_id')::uuid,(row_data->>'user_id')::uuid,(row_data->>'created_by')::uuid);
 ELSE owner_id:=(row_data->>'user_id')::uuid;END IF;
 IF owner_id IS NULL THEN RETURN NEW;END IF;
 SELECT closed_at,session_version INTO account_closed,epoch FROM public.users WHERE id=owner_id FOR UPDATE;
 IF NOT FOUND OR account_closed IS NOT NULL THEN
  IF TG_TABLE_NAME='jobs' AND TG_OP='UPDATE' THEN
   IF (row_data-metadata_fields-'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-metadata_fields-'updated_at')
    AND EXISTS(SELECT 1 FROM public.source_import_visibility_pending p WHERE p.job_id=(row_data->>'id')::uuid
     AND NOT EXISTS(SELECT 1 FROM jsonb_each(p.payload) e WHERE row_data->e.key IS DISTINCT FROM e.value)
     AND (SELECT count(*) FROM jsonb_object_keys(p.payload))=cardinality(metadata_fields)
     AND p.payload ?& metadata_fields) THEN RETURN NEW;END IF;
  END IF;
  RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='telegram_sessions' AND COALESCE((row_data->'data'->>'account_session_version')::integer,0)<>epoch THEN RAISE EXCEPTION 'Session revoked' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_source_business(p_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT COALESCE(jsonb_object_agg(e.key,e.value),'{}'::jsonb) FROM jsonb_each(p_row) e WHERE e.key=ANY(ARRAY[
 'source_url','title_uz','title_ru','company_name','description_uz','description_ru','salary_min','salary_max',
 'region_id','district_id','region_name','district_name','address','latitude','longitude','contact_phone','contact_email','contact_telegram','additional_phone','hr_name',
 'gender','age_min','age_max','education_level','experience','experience_years','working_hours','working_days','work_mode','payment_type','languages','skills','sections',
 'responsibilities_uz','requirements_uz','requirements_ru','benefits','category_id','source_category','source_subcategory','vacancy_count',
 'is_for_disabled','is_for_graduates','is_for_students','is_for_women','employment_type']);
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_track_import_edits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved public.job_import_state%ROWTYPE;before_data jsonb;after_data jsonb;field text;protected_fields text[];
BEGIN
 IF OLD.is_imported IS DISTINCT FROM true OR OLD.source='local' OR OLD.source IS NULL THEN RETURN NEW;END IF;
 before_data:=public.ishdasiz_source_business(to_jsonb(OLD));after_data:=public.ishdasiz_source_business(to_jsonb(NEW));
 IF before_data IS NOT DISTINCT FROM after_data THEN RETURN NEW;END IF;
 INSERT INTO public.job_import_state(job_id,baseline) VALUES(OLD.id,before_data) ON CONFLICT(job_id) DO NOTHING;
 SELECT * INTO saved FROM public.job_import_state WHERE job_id=OLD.id FOR UPDATE;
 -- This value exists only inside the importing transaction, while the job and
 -- state rows are locked. Other transactions never see an unconsumed marker.
 IF saved.pending IS NOT NULL AND after_data=saved.pending THEN RETURN NEW;END IF;
 protected_fields:=saved.overrides;
 FOR field IN SELECT jsonb_object_keys(after_data) LOOP
  IF after_data->field IS DISTINCT FROM before_data->field THEN
   IF after_data->field IS NOT DISTINCT FROM saved.baseline->field THEN protected_fields:=array_remove(protected_fields,field);
   ELSIF NOT field=ANY(protected_fields) THEN protected_fields:=array_append(protected_fields,field);END IF;
  END IF;
 END LOOP;
 UPDATE public.job_import_state SET overrides=protected_fields,updated_at=clock_timestamp() WHERE job_id=OLD.id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ishdasiz_track_import_edits ON public.jobs;
CREATE TRIGGER ishdasiz_track_import_edits BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_track_import_edits();
CREATE OR REPLACE FUNCTION public.ishdasiz_source_run(p_run_id uuid,p_token uuid)
RETURNS public.source_import_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;
BEGIN
 SELECT * INTO run FROM public.source_import_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND OR p_token IS NULL OR run.lease_token IS DISTINCT FROM p_token OR run.state<>'running' OR run.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Import lease unavailable' USING ERRCODE='40001';END IF;
 IF run.actor_id IS NOT NULL THEN
  PERFORM 1 FROM public.admin_profiles WHERE id=run.actor_id AND role='super_admin' AND disabled_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';END IF;
 END IF;
 RETURN run;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_begin_source_import(p_source text,p_actor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;
BEGIN
 IF p_source IS NULL OR p_source !~ '^[a-z][a-z0-9_-]{0,63}$' OR p_source='local' THEN RAISE EXCEPTION 'Invalid source' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ishdasiz-import:'||p_source,0));
 IF p_actor_id IS NOT NULL THEN
  PERFORM 1 FROM public.admin_profiles WHERE id=p_actor_id AND role='super_admin' AND disabled_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.source_import_runs SET state='abandoned',completed_at=clock_timestamp() WHERE source=p_source AND state='running' AND lease_until<=clock_timestamp();
 IF EXISTS(SELECT 1 FROM public.source_import_runs WHERE source=p_source AND state='running') THEN RAISE EXCEPTION 'Import already running' USING ERRCODE='55P03';END IF;
 INSERT INTO public.source_import_runs(source,actor_id) VALUES(p_source,p_actor_id) RETURNING * INTO run;
 RETURN jsonb_build_object('id',run.id,'token',run.lease_token);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_merge_source_job(p_run_id uuid,p_token uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;job public.jobs%ROWTYPE;typed public.jobs%ROWTYPE;saved public.job_import_state%ROWTYPE;
 business jsonb;next_data jsonb;incoming jsonb;body jsonb;field text;columns_sql text;assignments text;new_job boolean;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR jsonb_typeof(p_payload->'source_id') IS DISTINCT FROM 'string'
 OR length(p_payload->>'source_id') NOT BETWEEN 1 AND 128 OR (p_payload->>'source_id') ~ '\s' THEN RAISE EXCEPTION 'Invalid source job' USING ERRCODE='22023';END IF;
 business:=public.ishdasiz_source_business(p_payload);
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('source_id','raw_source_json') AND NOT business ? k) THEN RAISE EXCEPTION 'Invalid source field' USING ERRCODE='22023';END IF;
 -- The leased run serializes its batches. A second process cannot merge the
 -- same source while this lease is live; an expired process is fenced above.
 SELECT * INTO job FROM public.jobs WHERE source=run.source AND source_id=p_payload->>'source_id' FOR UPDATE;
 new_job:=NOT FOUND;
 IF NOT new_job AND job.is_imported IS DISTINCT FROM true THEN RAISE EXCEPTION 'Local job cannot be imported' USING ERRCODE='40001';END IF;
 typed:=jsonb_populate_record(job,business);
 incoming:=public.ishdasiz_source_business(to_jsonb(typed));
 SELECT COALESCE(jsonb_object_agg(e.key,e.value),'{}'::jsonb) INTO business FROM jsonb_each(business) e WHERE to_jsonb(typed) ? e.key;
 IF new_job THEN
  body:=business||jsonb_build_object('source',run.source,'source_id',p_payload->>'source_id','is_imported',true,'source_status','active',
   'status','active','is_active',true,'views_count',0,'last_synced_at',clock_timestamp(),'last_seen_at',clock_timestamp(),'last_checked_at',clock_timestamp());
  IF p_payload ? 'raw_source_json' THEN body:=body||jsonb_build_object('raw_source_json',p_payload->'raw_source_json');END IF;
  SELECT string_agg(format('%I',key),',' ORDER BY key) INTO columns_sql FROM jsonb_object_keys(body) AS key
   WHERE EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.jobs'::regclass AND attname=key AND attnum>0 AND NOT attisdropped);
  EXECUTE format('INSERT INTO public.jobs(%s) SELECT %s FROM jsonb_populate_record(NULL::public.jobs,$1) RETURNING *',columns_sql,columns_sql) INTO job USING body;
  INSERT INTO public.job_import_state(job_id,baseline) VALUES(job.id,public.ishdasiz_source_business(to_jsonb(job)));
 ELSE
  SELECT * INTO saved FROM public.job_import_state WHERE job_id=job.id FOR UPDATE;
  IF NOT FOUND THEN
   -- Older rows have no trustworthy baseline. Preserve their existing differing
   -- values on the first sync rather than guessing which edits came from people.
   saved.overrides:='{}';
   FOR field IN SELECT jsonb_object_keys(business) LOOP
    IF to_jsonb(job)->field IS DISTINCT FROM incoming->field THEN saved.overrides:=array_append(saved.overrides,field);END IF;
   END LOOP;
   INSERT INTO public.job_import_state(job_id,baseline,overrides) VALUES(job.id,incoming,saved.overrides) RETURNING * INTO saved;
  END IF;
  next_data:=public.ishdasiz_source_business(to_jsonb(job));
  FOR field IN SELECT jsonb_object_keys(business) LOOP
   IF NOT field=ANY(saved.overrides) THEN next_data:=jsonb_set(next_data,ARRAY[field],incoming->field);END IF;
  END LOOP;
  UPDATE public.job_import_state SET pending=next_data WHERE job_id=job.id;
  body:=next_data||jsonb_build_object('source_status','active','last_synced_at',clock_timestamp(),'last_seen_at',clock_timestamp(),'last_checked_at',clock_timestamp());
  IF p_payload ? 'raw_source_json' THEN body:=body||jsonb_build_object('raw_source_json',p_payload->'raw_source_json');END IF;
  SELECT string_agg(format('%I=source.%I',key,key),',' ORDER BY key) INTO assignments FROM jsonb_object_keys(body) AS key;
  EXECUTE format('UPDATE public.jobs AS target SET %s FROM jsonb_populate_record(NULL::public.jobs,$1) AS source WHERE target.id=$2 RETURNING target.*',assignments) INTO job USING body,job.id;
  UPDATE public.job_import_state SET baseline=incoming,pending=null,updated_at=clock_timestamp() WHERE job_id=job.id;
 END IF;
 UPDATE public.source_import_runs SET lease_until=clock_timestamp()+interval '10 minutes' WHERE id=run.id;
 RETURN jsonb_build_object('id',job.id,'created',new_job);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_finish_source_import(p_run_id uuid,p_token uuid,p_complete boolean,p_active text[],p_filled text[],p_removed text[],p_total integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;all_ids text[];affected integer:=0;checked_at timestamptz:=clock_timestamp();
BEGIN
 IF p_complete IS NULL THEN RAISE EXCEPTION 'Completion required' USING ERRCODE='22023';END IF;
 IF p_complete THEN run:=public.ishdasiz_source_run(p_run_id,p_token);
 ELSE
  -- A revoked administrator's worker may release its own run, without gaining
  -- permission to change any job or to release a replacement process's lease.
  SELECT * INTO run FROM public.source_import_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND OR p_token IS NULL OR run.lease_token IS DISTINCT FROM p_token OR run.state<>'running' THEN RAISE EXCEPTION 'Import lease unavailable' USING ERRCODE='40001';END IF;
 END IF;
 IF p_complete THEN
  IF p_active IS NULL OR p_filled IS NULL OR p_removed IS NULL OR p_total IS NULL OR p_total<0 OR p_total>100000 THEN RAISE EXCEPTION 'Invalid source snapshot' USING ERRCODE='22023';END IF;
  all_ids:=p_active||p_filled||p_removed;
  IF cardinality(all_ids)<>p_total OR (SELECT count(DISTINCT value) FROM unnest(all_ids) value)<>p_total
   OR EXISTS(SELECT 1 FROM unnest(all_ids) value WHERE value IS NULL OR length(value) NOT BETWEEN 1 AND 128 OR value ~ '\s') THEN RAISE EXCEPTION 'Inconsistent source snapshot' USING ERRCODE='22023';END IF;
  INSERT INTO public.source_import_visibility_pending(job_id,run_id,payload)
   SELECT id,run.id,jsonb_build_object('source_status',CASE WHEN source_id=ANY(p_active) THEN 'active' WHEN source_id=ANY(p_filled) THEN 'filled' ELSE 'removed_at_source' END,
    'last_checked_at',checked_at,'last_synced_at',checked_at,'last_seen_at',CASE WHEN source_id=ANY(p_active) THEN checked_at ELSE last_seen_at END)
   FROM public.jobs WHERE source=run.source AND is_imported=true AND source_id IS NOT NULL FOR UPDATE;
  UPDATE public.jobs j SET source_status=p.payload->>'source_status',last_checked_at=(p.payload->>'last_checked_at')::timestamptz,
   last_synced_at=(p.payload->>'last_synced_at')::timestamptz,last_seen_at=(p.payload->>'last_seen_at')::timestamptz
   FROM public.source_import_visibility_pending p WHERE p.run_id=run.id AND j.id=p.job_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  DELETE FROM public.source_import_visibility_pending WHERE run_id=run.id;
 END IF;
 UPDATE public.source_import_runs SET state=CASE WHEN p_complete THEN 'completed' ELSE 'failed' END,completed_at=clock_timestamp(),counters=jsonb_build_object('source_total',p_total,'checked',affected) WHERE id=run.id;
 RETURN jsonb_build_object('checked',affected,'complete',p_complete);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_source_business(jsonb),public.ishdasiz_track_import_edits(),public.ishdasiz_source_run(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.ishdasiz_begin_source_import(text,uuid),public.ishdasiz_merge_source_job(uuid,uuid,jsonb),public.ishdasiz_finish_source_import(uuid,uuid,boolean,text[],text[],text[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_begin_source_import(text,uuid),public.ishdasiz_merge_source_job(uuid,uuid,jsonb),public.ishdasiz_finish_source_import(uuid,uuid,boolean,text[],text[],text[],integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
