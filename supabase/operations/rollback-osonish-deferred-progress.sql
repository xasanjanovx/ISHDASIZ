-- Manual rollback only: restores the pre-fix RPC bodies without touching rows or schedules.
-- Private helpers remain inaccessible and unused; no destructive DROP is required.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_item(p_run_id uuid, p_token uuid, p_source_id text, p_state text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_refresh_batch(p_run_id uuid, p_token uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_refresh_item(p_run_id uuid, p_token uuid, p_source_id text, p_state text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE run public.source_import_runs%ROWTYPE;checked_at timestamptz:=clock_timestamp();
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 IF NOT EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE run_id=run.id AND protocol_version=2) THEN
  RAISE EXCEPTION 'Import protocol changed' USING ERRCODE='40001';
 END IF;
 PERFORM public.ishdasiz_osonish_item(run.id,p_token,p_source_id,p_state,p_payload);
 -- One unavailable card must not prevent checking the remaining candidates.
 -- Keep its error durable and report the incomplete run only after the queue.
 IF EXISTS(SELECT 1 FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id
  WHERE r.id=run.id AND r.state='failed' AND c.last_error='detail_unavailable') THEN
  UPDATE public.source_import_runs SET state='running',completed_at=null,lease_until=clock_timestamp()+interval '90 seconds' WHERE id=run.id;
  UPDATE public.source_import_checkpoints SET phase=CASE WHEN EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND state='pending') THEN 'details' ELSE 'verify' END,
   last_error=null WHERE run_id=run.id;
 END IF;
 IF p_state<>'retry' THEN
  -- Exact-row metadata capability also permits source checks for closed owners,
  -- without changing their content, ownership or publication choice.
  INSERT INTO public.source_import_visibility_pending(job_id,run_id,payload)
   SELECT id,run.id,jsonb_build_object('source_status',CASE p_state WHEN 'active' THEN 'active' WHEN 'filled' THEN 'filled' ELSE 'removed_at_source' END,
    'last_checked_at',checked_at,'last_synced_at',checked_at,'last_seen_at',CASE WHEN p_state='active' THEN checked_at ELSE last_seen_at END)
   FROM public.jobs WHERE source='osonish' AND is_imported=true AND source_id=p_source_id FOR UPDATE;
  UPDATE public.jobs j SET source_status=p.payload->>'source_status',last_checked_at=(p.payload->>'last_checked_at')::timestamptz,
   last_synced_at=(p.payload->>'last_synced_at')::timestamptz,last_seen_at=(p.payload->>'last_seen_at')::timestamptz
   FROM public.source_import_visibility_pending p WHERE p.run_id=run.id AND j.id=p.job_id;
  DELETE FROM public.source_import_visibility_pending WHERE run_id=run.id;
  UPDATE public.source_import_items SET verified=true WHERE run_id=run.id AND source_id=p_source_id;
 END IF;
 RETURN public.ishdasiz_import_summary(run.id);
END $function$
;
COMMIT;
