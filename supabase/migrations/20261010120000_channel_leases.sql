-- Replace the old unfenced channel cron together with the new server worker.
BEGIN;
ALTER TABLE public.sync_worker_locks ADD COLUMN IF NOT EXISTS lease_token uuid;
ALTER TABLE public.sync_events ADD COLUMN IF NOT EXISTS lease_token uuid;
-- Old cron instances must stop instead of acquiring/releasing the new worker's
-- named lock without a token. Preserve generic locks for unrelated legacy jobs.
CREATE OR REPLACE FUNCTION public.acquire_worker_lock(p_name text,p_ttl_seconds integer DEFAULT 300)
RETURNS boolean LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF p_name='telegram_channel_sync' THEN RETURN false;END IF;
 INSERT INTO public.sync_worker_locks(worker_name,locked_until,updated_at)
  VALUES(p_name,clock_timestamp()+make_interval(secs=>GREATEST(30,p_ttl_seconds)),clock_timestamp())
  ON CONFLICT(worker_name) DO UPDATE SET locked_until=EXCLUDED.locked_until,updated_at=EXCLUDED.updated_at
  WHERE sync_worker_locks.locked_until IS NULL OR sync_worker_locks.locked_until<clock_timestamp();
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.release_worker_lock(p_name text)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF p_name='telegram_channel_sync' THEN RETURN;END IF;
 UPDATE public.sync_worker_locks SET locked_until=clock_timestamp(),updated_at=clock_timestamp() WHERE worker_name=p_name;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_lease(p_token uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE acquired boolean;
BEGIN
 IF p_token IS NULL OR p_action IS NULL OR p_action NOT IN('acquire','renew','release') THEN RAISE EXCEPTION 'Invalid channel lease' USING ERRCODE='22023';END IF;
 IF p_action='acquire' THEN
  INSERT INTO public.sync_worker_locks(worker_name,lease_token,locked_until,updated_at)
   VALUES('telegram_channel_sync',p_token,clock_timestamp()+interval '180 seconds',clock_timestamp())
   ON CONFLICT(worker_name) DO UPDATE SET lease_token=EXCLUDED.lease_token,locked_until=EXCLUDED.locked_until,updated_at=EXCLUDED.updated_at
   WHERE sync_worker_locks.locked_until IS NULL OR sync_worker_locks.locked_until<=clock_timestamp();
  acquired:=FOUND;
  IF acquired THEN
   UPDATE public.sync_events SET status='failed',next_retry_at=clock_timestamp(),last_error='Previous channel worker expired',lease_token=null
    WHERE status='processing';
  END IF;
  RETURN acquired;
 ELSIF p_action='renew' THEN
  UPDATE public.sync_worker_locks SET locked_until=clock_timestamp()+interval '180 seconds',updated_at=clock_timestamp()
   WHERE worker_name='telegram_channel_sync' AND lease_token=p_token AND locked_until>clock_timestamp();
 ELSE
  UPDATE public.sync_worker_locks SET locked_until=clock_timestamp(),lease_token=null,updated_at=clock_timestamp()
   WHERE worker_name='telegram_channel_sync' AND lease_token=p_token;
 END IF;
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_claim(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event public.sync_events%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.sync_worker_locks WHERE worker_name='telegram_channel_sync' AND lease_token=p_token AND locked_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel lease expired' USING ERRCODE='40001';END IF;
 SELECT * INTO event FROM public.sync_events WHERE status IN('pending','failed') AND attempts<8 AND next_retry_at<=clock_timestamp()
  ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN null;END IF;
 UPDATE public.sync_events SET status='processing',attempts=attempts+1,lease_token=p_token,last_error=null WHERE id=event.id RETURNING * INTO event;
 RETURN to_jsonb(event);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_finish(p_token uuid,p_event uuid,p_success boolean,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_success IS NULL THEN RAISE EXCEPTION 'Invalid channel result' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM public.sync_worker_locks WHERE worker_name='telegram_channel_sync' AND lease_token=p_token AND locked_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel lease expired' USING ERRCODE='40001';END IF;
 UPDATE public.sync_events SET status=CASE WHEN p_success THEN 'done' ELSE 'failed' END,
  processed_at=CASE WHEN p_success THEN clock_timestamp() ELSE processed_at END,
  last_error=CASE WHEN p_success THEN null ELSE left(COALESCE(p_error,'Channel operation failed'),2000) END,
  next_retry_at=CASE WHEN p_success THEN next_retry_at ELSE clock_timestamp()+make_interval(secs=>LEAST(3600,60*power(2,LEAST(attempts,6)))::integer) END,
  lease_token=null WHERE id=p_event AND status='processing' AND lease_token=p_token;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_channel_lease(uuid,text),public.ishdasiz_channel_claim(uuid),public.ishdasiz_channel_finish(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_channel_lease(uuid,text),public.ishdasiz_channel_claim(uuid),public.ishdasiz_channel_finish(uuid,uuid,boolean,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
