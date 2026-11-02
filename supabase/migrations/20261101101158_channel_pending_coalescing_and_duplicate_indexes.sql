-- Reduce repeated reconciliation work without deleting any queued or business row.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='12s';
SET LOCAL maintenance_work_mem='16MB';

-- A claim must seek the oldest eligible event instead of sorting the backlog.
CREATE INDEX IF NOT EXISTS ishdasiz_sync_claim_order_idx
 ON public.sync_events(created_at,id)
 WHERE status IN('pending','failed') AND attempts<8;

CREATE OR REPLACE FUNCTION public.enqueue_job_sync_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE doc jsonb;job_action text;
BEGIN
 IF TG_OP='UPDATE' AND
  (to_jsonb(NEW)-ARRAY['updated_at','views','views_count','last_seen_at','last_synced_at','last_checked_at'])
  IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','views','views_count','last_seen_at','last_synced_at','last_checked_at']) THEN RETURN NEW;END IF;
 IF TG_OP='DELETE' THEN doc:=to_jsonb(OLD);job_action:='delete';
 ELSE doc:=to_jsonb(NEW);job_action:=CASE WHEN public.ishdasiz_job_available(NEW) THEN 'upsert' ELSE 'deactivate' END;END IF;
 -- The worker reads the current canonical vacancy, not the event payload.
 -- Lock an untouched pending event; a worker claiming it must see the new
 -- vacancy only after this transaction commits. If it is already locked,
 -- queue a follow-up instead of losing the change during publication.
 PERFORM 1 FROM public.sync_events e
  WHERE e.entity_type='job' AND e.entity_id=(doc->>'id')::uuid
   AND e.action=job_action AND e.region_id IS NOT DISTINCT FROM (doc->>'region_id')::bigint
   AND e.status='pending' AND e.attempts=0 AND e.lease_token IS NULL AND e.payload='{}'::jsonb
   AND e.next_retry_at<=clock_timestamp()
  ORDER BY e.created_at DESC,e.id DESC LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN
  INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
   VALUES('job',(doc->>'id')::uuid,job_action,(doc->>'region_id')::bigint,'{}'::jsonb,'pending',clock_timestamp());
 END IF;
 RETURN COALESCE(NEW,OLD);
END
$function$;
REVOKE ALL ON FUNCTION public.enqueue_job_sync_event() FROM PUBLIC,anon,authenticated,service_role;

-- Compare complete index semantics and preserve all constraints. Missing
-- legacy duplicates are harmless on a fresh or previously optimized target.
DO $deduplicate$
DECLARE pair text[];drop_oid oid;keep_oid oid;drop_signature jsonb;keep_signature jsonb;
BEGIN
 FOREACH pair SLICE 1 IN ARRAY ARRAY[
  ARRAY['idx_jobs_employer','idx_jobs_employer_id'],
  ARRAY['idx_jobs_status_sync','idx_jobs_status'],
  ARRAY['idx_jobs_source_source_id','idx_jobs_source_unique'],
  ARRAY['idx_resumes_status_sync','idx_resumes_status']
 ] LOOP
  drop_oid:=to_regclass('public.'||pair[1]);keep_oid:=to_regclass('public.'||pair[2]);
  IF drop_oid IS NULL OR keep_oid IS NULL THEN CONTINUE;END IF;
  SELECT jsonb_build_object('table',i.indrelid,'method',c.relam,'unique',i.indisunique,
   'nulls',i.indnullsnotdistinct,'immediate',i.indimmediate,'keys',i.indkey::text,
   'key_count',i.indnkeyatts,'attribute_count',i.indnatts,'collations',i.indcollation::text,
   'opclasses',i.indclass::text,'options',i.indoption::text,
   'expressions',pg_get_expr(i.indexprs,i.indrelid),'predicate',pg_get_expr(i.indpred,i.indrelid))
   INTO drop_signature FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
   WHERE i.indexrelid=drop_oid AND i.indisvalid AND i.indisready AND NOT i.indisprimary;
  SELECT jsonb_build_object('table',i.indrelid,'method',c.relam,'unique',i.indisunique,
   'nulls',i.indnullsnotdistinct,'immediate',i.indimmediate,'keys',i.indkey::text,
   'key_count',i.indnkeyatts,'attribute_count',i.indnatts,'collations',i.indcollation::text,
   'opclasses',i.indclass::text,'options',i.indoption::text,
   'expressions',pg_get_expr(i.indexprs,i.indrelid),'predicate',pg_get_expr(i.indpred,i.indrelid))
   INTO keep_signature FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
   WHERE i.indexrelid=keep_oid AND i.indisvalid AND i.indisready;
  IF drop_signature IS NULL OR keep_signature IS NULL OR drop_signature IS DISTINCT FROM keep_signature
   OR EXISTS(SELECT 1 FROM pg_constraint WHERE conindid=drop_oid) THEN
   RAISE EXCEPTION 'Index pair is not safely redundant: %, %',pair[1],pair[2];
  END IF;
  EXECUTE format('DROP INDEX %I.%I','public',pair[1]);
 END LOOP;
END
$deduplicate$;
COMMIT;
