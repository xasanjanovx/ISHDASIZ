-- Optional producer rollback only; preserves all rows, receipts, indexes and schedules.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='5s';
CREATE OR REPLACE FUNCTION public.enqueue_job_sync_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE doc jsonb; action text;
BEGIN
 IF TG_OP='UPDATE' AND
  (to_jsonb(NEW)-ARRAY['updated_at','views','views_count','last_seen_at','last_synced_at','last_checked_at'])
  IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','views','views_count','last_seen_at','last_synced_at','last_checked_at']) THEN RETURN NEW;END IF;
 IF TG_OP='DELETE' THEN doc:=to_jsonb(OLD);action:='delete';
 ELSE doc:=to_jsonb(NEW);action:=CASE WHEN public.ishdasiz_job_available(NEW) THEN 'upsert' ELSE 'deactivate' END;END IF;
 INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
  VALUES('job',(doc->>'id')::uuid,action,(doc->>'region_id')::bigint,'{}'::jsonb,'pending',clock_timestamp());
 RETURN COALESCE(NEW,OLD);
END $function$
;
REVOKE ALL ON FUNCTION public.enqueue_job_sync_event() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
