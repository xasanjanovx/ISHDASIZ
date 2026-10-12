-- Apply after source_import_state, with the unified site importer. No live
-- scheduler is installed by this migration and no source request is issued.
BEGIN;
CREATE TABLE IF NOT EXISTS public.source_import_checkpoints(
 run_id uuid PRIMARY KEY REFERENCES public.source_import_runs(id),request_id uuid UNIQUE,
 phase text NOT NULL DEFAULT 'list' CHECK(phase IN ('list','details','verify','done')),
 next_page integer NOT NULL DEFAULT 1,verify_page integer NOT NULL DEFAULT 1,
 total integer,last_page integer,max_pages integer NOT NULL CHECK(max_pages BETWEEN 1 AND 500),
 consecutive_errors integer NOT NULL DEFAULT 0,last_error text,
 created_count integer NOT NULL DEFAULT 0,updated_count integer NOT NULL DEFAULT 0,skipped_closed integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.source_import_items(
 run_id uuid NOT NULL REFERENCES public.source_import_runs(id),source_id text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','filled','removed','error')),
 attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT clock_timestamp(),verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(run_id,source_id)
);
CREATE INDEX IF NOT EXISTS source_import_items_pending ON public.source_import_items(run_id,state,available_at,source_id);
DO $$ DECLARE tbl text;col text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['source_import_checkpoints','source_import_items'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE ALL(%I) ON public.%I FROM PUBLIC,anon,authenticated,service_role',col,tbl);
  END LOOP;
 END LOOP;
END $$;
-- Internal projection: no source contents, contact data or lease tokens.
CREATE OR REPLACE FUNCTION public.ishdasiz_import_summary(p_run_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('id',r.id,'state',r.state,'phase',c.phase,'started_at',r.started_at,'completed_at',r.completed_at,
  'total',c.total,'listed',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id),
  'processed',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id AND state IN ('active','filled','removed')),
  'failed',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id AND state='error'),
  'verified',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id AND verified),
  'new_imported',c.created_count,'updated',c.updated_count,'skipped_closed',c.skipped_closed,'next_page',c.next_page,'verify_page',c.verify_page,
  'last_error',c.last_error,'next_retry_at',(SELECT min(available_at) FROM public.source_import_items WHERE run_id=r.id AND state='pending'),
  'busy',r.state='running' AND r.lease_until>clock_timestamp())
 FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id WHERE r.id=p_run_id;
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_import_status(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid;
BEGIN
 IF p_actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE id=p_actor_id AND role='super_admin' AND disabled_at IS NULL) THEN RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';END IF;
 SELECT r.id INTO target FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id WHERE r.source='osonish' ORDER BY r.started_at DESC,r.id DESC LIMIT 1;
 RETURN public.ishdasiz_import_summary(target);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_claim_osonish_import(p_actor_id uuid DEFAULT NULL,p_run_id uuid DEFAULT NULL,p_request_id uuid DEFAULT NULL,p_start boolean DEFAULT false,p_max_pages integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;checkpoint public.source_import_checkpoints%ROWTYPE;created jsonb;
BEGIN
 IF p_start IS NULL OR p_max_pages IS NULL OR p_max_pages NOT BETWEEN 1 AND 500 OR (p_start AND p_request_id IS NULL) THEN RAISE EXCEPTION 'Invalid import request' USING ERRCODE='22023';END IF;
 IF p_actor_id IS NOT NULL THEN
  PERFORM 1 FROM public.admin_profiles WHERE id=p_actor_id AND role='super_admin' AND disabled_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin unavailable' USING ERRCODE='42501';END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ishdasiz-import:osonish',0));
 IF p_run_id IS NOT NULL THEN
  SELECT * INTO run FROM public.source_import_runs WHERE id=p_run_id AND source='osonish' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE run_id=run.id) THEN RAISE EXCEPTION 'Import unavailable' USING ERRCODE='P0002';END IF;
 ELSIF p_start AND EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE request_id=p_request_id) THEN
  SELECT r.* INTO run FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id WHERE c.request_id=p_request_id FOR UPDATE OF r;
  SELECT * INTO checkpoint FROM public.source_import_checkpoints WHERE run_id=run.id;
  IF run.actor_id IS DISTINCT FROM p_actor_id OR checkpoint.max_pages<>p_max_pages THEN RAISE EXCEPTION 'Import request changed' USING ERRCODE='40001';END IF;
 ELSE
  SELECT * INTO run FROM public.source_import_runs WHERE source='osonish' AND state='running' ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND NOT EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE run_id=run.id) THEN RAISE EXCEPTION 'Another importer is running' USING ERRCODE='55P03';END IF;
  IF FOUND AND p_start THEN RAISE EXCEPTION 'An import is already running; continue it instead' USING ERRCODE='55P03';END IF;
  IF NOT FOUND THEN
   IF NOT p_start THEN
    SELECT r.* INTO run FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id WHERE r.source='osonish' AND r.started_at>clock_timestamp()-interval '6 hours' ORDER BY r.started_at DESC LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),'token',null);END IF;
   END IF;
   created:=public.ishdasiz_begin_source_import('osonish',p_actor_id);
   SELECT * INTO run FROM public.source_import_runs WHERE id=(created->>'id')::uuid FOR UPDATE;
   INSERT INTO public.source_import_checkpoints(run_id,request_id,max_pages) VALUES(run.id,p_request_id,p_max_pages);
   -- The newly created run has not been claimed by a different request.
   run.lease_until:=clock_timestamp()-interval '1 second';
  END IF;
 END IF;
 IF run.state<>'running' OR run.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),'token',null);END IF;
 IF run.actor_id IS NOT NULL THEN
  PERFORM 1 FROM public.admin_profiles WHERE id=run.actor_id AND role='super_admin' AND disabled_at IS NULL FOR SHARE;
  IF NOT FOUND THEN
   UPDATE public.source_import_runs SET state='failed',completed_at=clock_timestamp() WHERE id=run.id;
   UPDATE public.source_import_checkpoints SET last_error='permission_changed' WHERE run_id=run.id;
   RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),'token',null);
  END IF;
 END IF;
 IF run.started_at<clock_timestamp()-interval '24 hours' THEN
  UPDATE public.source_import_runs SET state='failed',completed_at=clock_timestamp() WHERE id=run.id;
  UPDATE public.source_import_checkpoints SET last_error='snapshot_expired' WHERE run_id=run.id;
  RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),'token',null);
 END IF;
 UPDATE public.source_import_runs SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds' WHERE id=run.id RETURNING * INTO run;
 RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),'token',run.lease_token);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_work(p_run_id uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),'ids',COALESCE((SELECT jsonb_agg(source_id ORDER BY source_id) FROM
  (SELECT source_id FROM public.source_import_items WHERE run_id=run.id AND state='pending' AND available_at<=clock_timestamp() ORDER BY source_id LIMIT 50) batch),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_page(p_run_id uuid,p_token uuid,p_page integer,p_ids text[],p_total integer,p_last_page integer,p_verify boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;c public.source_import_checkpoints%ROWTYPE;n integer;active_ids text[];filled_ids text[];removed_ids text[];
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 SELECT * INTO c FROM public.source_import_checkpoints WHERE run_id=run.id FOR UPDATE;
 IF NOT FOUND OR p_verify IS NULL OR c.phase IS DISTINCT FROM (CASE WHEN p_verify THEN 'verify' ELSE 'list' END)
  OR p_page IS DISTINCT FROM (CASE WHEN p_verify THEN c.verify_page ELSE c.next_page END) THEN RAISE EXCEPTION 'Import page changed' USING ERRCODE='40001';END IF;
 IF p_ids IS NULL OR cardinality(p_ids)>100 OR p_total IS NULL OR p_total NOT BETWEEN 0 AND 100000 OR p_last_page IS NULL OR p_last_page NOT BETWEEN 1 AND c.max_pages
  OR p_page>p_last_page OR (p_total=0 AND (p_last_page<>1 OR cardinality(p_ids)<>0)) OR (p_total>0 AND cardinality(p_ids)=0)
  OR cardinality(p_ids)<>(SELECT count(DISTINCT value) FROM unnest(p_ids) value)
  OR EXISTS(SELECT 1 FROM unnest(p_ids) value WHERE value IS NULL OR CASE WHEN value ~ '^[1-9][0-9]{0,15}$' THEN value::numeric>9007199254740991 ELSE true END) THEN RAISE EXCEPTION 'Invalid source page' USING ERRCODE='22023';END IF;
 IF c.total IS NOT NULL AND (c.total<>p_total OR c.last_page<>p_last_page) THEN RAISE EXCEPTION 'Source list changed' USING ERRCODE='22023';END IF;
 IF p_verify THEN
  IF EXISTS(SELECT 1 FROM unnest(p_ids) value WHERE NOT EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND source_id=value AND NOT verified)) THEN RAISE EXCEPTION 'Source list changed' USING ERRCODE='22023';END IF;
  UPDATE public.source_import_items SET verified=true WHERE run_id=run.id AND source_id=ANY(p_ids);
  SELECT count(*) INTO n FROM public.source_import_items WHERE run_id=run.id AND verified;
 ELSE
  IF EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND source_id=ANY(p_ids)) THEN RAISE EXCEPTION 'Repeated source ID' USING ERRCODE='22023';END IF;
  INSERT INTO public.source_import_items(run_id,source_id) SELECT run.id,value FROM unnest(p_ids) value;
  SELECT count(*) INTO n FROM public.source_import_items WHERE run_id=run.id;
 END IF;
 IF n>p_total OR (p_page=p_last_page AND n<>p_total) OR (p_page<p_last_page AND n>=p_total) THEN RAISE EXCEPTION 'Incomplete source list' USING ERRCODE='22023';END IF;
 UPDATE public.source_import_checkpoints SET total=p_total,last_page=p_last_page,consecutive_errors=0,last_error=null,
  next_page=CASE WHEN p_verify THEN next_page ELSE p_page+1 END,verify_page=CASE WHEN p_verify THEN p_page+1 ELSE verify_page END,
  phase=CASE WHEN p_page=p_last_page THEN CASE WHEN p_verify THEN 'done' WHEN p_total=0 THEN 'verify' ELSE 'details' END ELSE phase END WHERE run_id=run.id;
 IF p_verify AND p_page=p_last_page THEN
  IF EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND state NOT IN ('active','filled','removed')) THEN RAISE EXCEPTION 'Details incomplete' USING ERRCODE='40001';END IF;
  SELECT COALESCE(array_agg(source_id) FILTER(WHERE state='active'),'{}'),COALESCE(array_agg(source_id) FILTER(WHERE state='filled'),'{}'),COALESCE(array_agg(source_id) FILTER(WHERE state='removed'),'{}') INTO active_ids,filled_ids,removed_ids FROM public.source_import_items WHERE run_id=run.id;
  PERFORM public.ishdasiz_finish_source_import(run.id,p_token,true,active_ids,filled_ids,removed_ids,p_total);
 END IF;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_item(p_run_id uuid,p_token uuid,p_source_id text,p_state text,p_payload jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;item public.source_import_items%ROWTYPE;saved jsonb;existing public.jobs%ROWTYPE;owner_id uuid;owner_open boolean:=true;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 IF NOT EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE run_id=run.id AND phase='details') THEN RAISE EXCEPTION 'Import phase changed' USING ERRCODE='40001';END IF;
 SELECT * INTO item FROM public.source_import_items WHERE run_id=run.id AND source_id=p_source_id FOR UPDATE;
 IF NOT FOUND OR item.state<>'pending' OR item.available_at>clock_timestamp() THEN RAISE EXCEPTION 'Import item changed' USING ERRCODE='40001';END IF;
 IF p_state IS NULL OR p_state NOT IN ('active','filled','removed','retry') THEN RAISE EXCEPTION 'Invalid source state' USING ERRCODE='22023';END IF;
 IF p_state='active' THEN
  IF p_payload->>'source_id' IS DISTINCT FROM p_source_id THEN RAISE EXCEPTION 'Source item mismatch' USING ERRCODE='22023';END IF;
  SELECT * INTO existing FROM public.jobs WHERE source='osonish' AND source_id=p_source_id FOR UPDATE;
  IF FOUND THEN
   IF existing.is_imported IS DISTINCT FROM true THEN RAISE EXCEPTION 'Local job cannot be imported' USING ERRCODE='40001';END IF;
   owner_id:=public.ishdasiz_job_owner(existing.employer_id,existing.user_id,existing.created_by);
   IF owner_id IS NOT NULL THEN
    SELECT closed_at IS NULL INTO owner_open FROM public.users WHERE id=owner_id FOR UPDATE;
    owner_open:=COALESCE(owner_open,false);
   END IF;
  END IF;
  IF owner_open THEN
   saved:=public.ishdasiz_merge_source_job(run.id,p_token,p_payload);
   UPDATE public.source_import_checkpoints SET created_count=created_count+CASE WHEN (saved->>'created')::boolean THEN 1 ELSE 0 END,updated_count=updated_count+CASE WHEN (saved->>'created')::boolean THEN 0 ELSE 1 END WHERE run_id=run.id;
  ELSE
   UPDATE public.source_import_checkpoints SET skipped_closed=skipped_closed+1 WHERE run_id=run.id;
  END IF;
  UPDATE public.source_import_runs SET lease_until=clock_timestamp()+interval '90 seconds' WHERE id=run.id;
 ELSIF p_payload IS NOT NULL THEN RAISE EXCEPTION 'Unexpected source payload' USING ERRCODE='22023';END IF;
 UPDATE public.source_import_items SET attempts=attempts+1,state=CASE WHEN p_state='retry' THEN CASE WHEN attempts>=2 THEN 'error' ELSE 'pending' END ELSE p_state END,
  available_at=clock_timestamp()+make_interval(secs=>30*(attempts+1)) WHERE run_id=run.id AND source_id=p_source_id;
 IF p_state<>'retry' THEN UPDATE public.source_import_checkpoints SET consecutive_errors=0,last_error=null WHERE run_id=run.id;END IF;
 IF EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND state='error') THEN
  UPDATE public.source_import_runs SET state='failed',completed_at=clock_timestamp(),lease_until=clock_timestamp() WHERE id=run.id;
  UPDATE public.source_import_checkpoints SET last_error='detail_unavailable' WHERE run_id=run.id;
 ELSIF NOT EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND state='pending') THEN
  UPDATE public.source_import_checkpoints SET phase='verify',last_error=null WHERE run_id=run.id;
 END IF;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_yield_osonish_import(p_run_id uuid,p_token uuid,p_error text DEFAULT NULL,p_fatal boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;n integer;
BEGIN
 SELECT * INTO run FROM public.source_import_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND OR p_token IS NULL OR run.lease_token IS DISTINCT FROM p_token OR NOT EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE run_id=run.id) THEN RAISE EXCEPTION 'Import lease unavailable' USING ERRCODE='40001';END IF;
 IF p_fatal IS NULL OR p_error IS NOT NULL AND p_error NOT IN ('source_unavailable','snapshot_changed','write_failed','permission_changed','invalid_data','request_timeout') THEN RAISE EXCEPTION 'Invalid import error' USING ERRCODE='22023';END IF;
 IF run.state='running' THEN
  UPDATE public.source_import_checkpoints SET consecutive_errors=CASE WHEN p_error IS NULL THEN consecutive_errors ELSE consecutive_errors+1 END,last_error=COALESCE(p_error,last_error) WHERE run_id=run.id RETURNING consecutive_errors INTO n;
  UPDATE public.source_import_runs SET lease_until=clock_timestamp(),state=CASE WHEN p_fatal OR n>=3 THEN 'failed' ELSE state END,completed_at=CASE WHEN p_fatal OR n>=3 THEN clock_timestamp() ELSE completed_at END WHERE id=run.id;
 END IF;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_import_summary(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.ishdasiz_osonish_import_status(uuid),public.ishdasiz_claim_osonish_import(uuid,uuid,uuid,boolean,integer),public.ishdasiz_osonish_work(uuid,uuid),public.ishdasiz_osonish_page(uuid,uuid,integer,text[],integer,integer,boolean),public.ishdasiz_osonish_item(uuid,uuid,text,text,jsonb),public.ishdasiz_yield_osonish_import(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_osonish_import_status(uuid),public.ishdasiz_claim_osonish_import(uuid,uuid,uuid,boolean,integer),public.ishdasiz_osonish_work(uuid,uuid),public.ishdasiz_osonish_page(uuid,uuid,integer,text[],integer,integer,boolean),public.ishdasiz_osonish_item(uuid,uuid,text,text,jsonb),public.ishdasiz_yield_osonish_import(uuid,uuid,text,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
