-- Durable send reservations: an unknown Telegram result must never auto-resend.
-- Apply with the channel worker; old direct writers must already be stopped.
BEGIN;
CREATE TABLE IF NOT EXISTS public.channel_delivery_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK(entity_type IN('job','resume')),
 entity_id uuid NOT NULL, channel_username text NOT NULL, event_id uuid NOT NULL, lease_token uuid NOT NULL,
 snapshot_hash text NOT NULL, message_hash text NOT NULL,
 status text NOT NULL DEFAULT 'sending' CHECK(status IN('sending','uncertain','confirmed','rejected')),
 message_id bigint CHECK(message_id BETWEEN 1 AND 9007199254740991),
 resolution text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_delivery_unresolved ON public.channel_delivery_intents(entity_type,entity_id) WHERE status IN('sending','uncertain');
CREATE TABLE IF NOT EXISTS public.channel_delivery_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK(entity_type IN('job','resume')),
 entity_id uuid NOT NULL, channel_username text NOT NULL, message_id bigint NOT NULL CHECK(message_id BETWEEN 1 AND 9007199254740991),
 message_hash text, status text NOT NULL CHECK(status IN('active','deleted','redacted')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(channel_username,message_id)
);
CREATE INDEX IF NOT EXISTS channel_delivery_receipts_entity ON public.channel_delivery_receipts(entity_type,entity_id,id);
ALTER TABLE public.channel_delivery_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_delivery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_delivery_intents,public.channel_delivery_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.channel_delivery_intents,public.channel_delivery_receipts TO service_role;
DO $$ DECLARE tbl text; col text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['channel_delivery_intents','channel_delivery_receipts'] LOOP
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.%I FROM PUBLIC,anon,authenticated',col,col,col,col,tbl);
  END LOOP;
 END LOOP;
END $$;

-- Preserve every known ID, including an overwritten legacy projection. Never
-- erase an old active receipt just because a new post replaces channel_posts.
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_copy_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.channel_username,OLD.message_id) IS DISTINCT FROM (NEW.channel_username,NEW.message_id) THEN
  INSERT INTO channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,message_hash,status)
   VALUES(OLD.entity_type,OLD.entity_id,OLD.channel_username,OLD.message_id,OLD.message_hash,OLD.status) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,message_hash,status)
  VALUES(NEW.entity_type,NEW.entity_id,NEW.channel_username,NEW.message_id,NEW.message_hash,NEW.status)
  ON CONFLICT(channel_username,message_id) DO UPDATE SET message_hash=EXCLUDED.message_hash,status=EXCLUDED.status,updated_at=clock_timestamp()
  WHERE channel_delivery_receipts.entity_type=EXCLUDED.entity_type AND channel_delivery_receipts.entity_id=EXCLUDED.entity_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel receipt belongs to another entity' USING ERRCODE='23505';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_channel_receipt_history ON public.channel_posts;
CREATE TRIGGER trg_channel_receipt_history AFTER INSERT OR UPDATE ON public.channel_posts FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_channel_copy_receipt();
INSERT INTO public.channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,message_hash,status)
 SELECT entity_type,entity_id,channel_username,message_id,message_hash,status FROM public.channel_posts ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM channel_posts c JOIN channel_delivery_receipts r USING(channel_username,message_id)
  WHERE (c.entity_type,c.entity_id) IS DISTINCT FROM (r.entity_type,r.entity_id)) THEN
  RAISE EXCEPTION 'Conflicting legacy channel receipts require review' USING ERRCODE='23505';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_target(p_snapshot jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_snapshot->>'available'='true' THEN CASE p_snapshot->>'region_slug'
 WHEN 'toshkent-shahri' THEN '@ishdasiz_toshkent' WHEN 'toshkent-shahar' THEN '@ishdasiz_toshkent'
 WHEN 'toshkent-viloyati' THEN '@ishdasiz_toshkent_vil' WHEN 'samarqand-viloyati' THEN '@ishdasiz_samarqand'
 WHEN 'navoiy-viloyati' THEN '@ishdasiz_navoiy' WHEN 'qoraqalpogiston-respublikasi' THEN '@ishdasiz_qoraqalpogiston'
 WHEN 'qashqadaryo-viloyati' THEN '@ishdasiz_qashqadaryo' WHEN 'surxondaryo-viloyati' THEN '@ishdasiz_surxondaryo'
 WHEN 'fargona-viloyati' THEN '@ishdasiz_fargona' WHEN 'namangan-viloyati' THEN '@ishdasiz_namangan'
 WHEN 'sirdaryo-viloyati' THEN '@ishdasiz_sirdaryo' WHEN 'jizzax-viloyati' THEN '@ishdasiz_jizzax'
 WHEN 'buxoro-viloyati' THEN '@ishdasiz_buxoro' WHEN 'xorazm-viloyati' THEN '@ishdasiz_xorazm'
 WHEN 'andijon-viloyati' THEN '@ishdasiz_andijon' END END
$$;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_send_begin(p_token uuid,p_event uuid,p_channel text,p_snapshot jsonb,p_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e sync_events%ROWTYPE;s jsonb;intent uuid;
BEGIN
 PERFORM 1 FROM sync_worker_locks WHERE worker_name='telegram_channel_sync' AND lease_token=p_token AND locked_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel lease expired' USING ERRCODE='40001';END IF;
 SELECT * INTO e FROM sync_events WHERE id=p_event AND status='processing' AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel event expired' USING ERRCODE='40001';END IF;
 s:=ishdasiz_channel_snapshot(e.entity_type,e.entity_id);
 IF p_snapshot IS NULL OR s IS DISTINCT FROM p_snapshot OR ishdasiz_channel_target(s) IS DISTINCT FROM p_channel OR p_channel IS NULL
  OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Channel publication changed' USING ERRCODE='40001';END IF;
 IF EXISTS(SELECT 1 FROM channel_delivery_intents WHERE entity_type=e.entity_type AND entity_id=e.entity_id AND status IN('sending','uncertain')) THEN
  RAISE EXCEPTION 'Channel delivery needs operator review' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM channel_delivery_receipts WHERE entity_type=e.entity_type AND entity_id=e.entity_id AND status='active') THEN
  RAISE EXCEPTION 'Channel post already exists' USING ERRCODE='40001';END IF;
 INSERT INTO channel_delivery_intents(entity_type,entity_id,channel_username,event_id,lease_token,snapshot_hash,message_hash)
  VALUES(e.entity_type,e.entity_id,p_channel,p_event,p_token,md5(s::text),p_hash) RETURNING id INTO intent;
 RETURN intent;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_send_result(p_token uuid,p_intent uuid,p_outcome text,p_message bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i channel_delivery_intents%ROWTYPE;r channel_delivery_receipts%ROWTYPE;s jsonb;
BEGIN
 -- Late acknowledgements remain valid evidence even after a lease expires.
 -- Only the exact durable reservation token can attach that evidence.
 PERFORM 1 FROM sync_worker_locks WHERE worker_name='telegram_channel_sync' FOR UPDATE;
 SELECT * INTO i FROM channel_delivery_intents WHERE id=p_intent AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel intent unavailable' USING ERRCODE='40001';END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN('confirmed','rejected','uncertain') THEN RAISE EXCEPTION 'Invalid channel outcome' USING ERRCODE='22023';END IF;
 IF p_outcome<>'confirmed' THEN
  IF p_message IS NOT NULL THEN RAISE EXCEPTION 'Invalid channel outcome' USING ERRCODE='22023';END IF;
  UPDATE channel_delivery_intents SET status=p_outcome,updated_at=clock_timestamp() WHERE id=i.id AND status IN('sending','uncertain');
  RETURN jsonb_build_object('recorded',true);
 END IF;
 IF p_message IS NULL OR p_message<1 OR p_message>9007199254740991 THEN RAISE EXCEPTION 'Invalid Telegram receipt' USING ERRCODE='22023';END IF;
 INSERT INTO channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,message_hash,status)
  VALUES(i.entity_type,i.entity_id,i.channel_username,p_message,i.message_hash,'active') ON CONFLICT(channel_username,message_id) DO NOTHING;
 SELECT * INTO r FROM channel_delivery_receipts WHERE channel_username=i.channel_username AND message_id=p_message FOR UPDATE;
 IF r.entity_type<>i.entity_type OR r.entity_id<>i.entity_id THEN RAISE EXCEPTION 'Channel receipt belongs to another entity' USING ERRCODE='23505';END IF;
 -- A repeated acknowledgement must not resurrect a deleted/redacted receipt.
 UPDATE channel_delivery_intents SET status='confirmed',message_id=COALESCE(message_id,p_message),updated_at=clock_timestamp() WHERE id=i.id;
 s:=ishdasiz_channel_snapshot(i.entity_type,i.entity_id);
 IF r.status='active' AND md5(s::text)=i.snapshot_hash AND ishdasiz_channel_target(s)=i.channel_username
  AND EXISTS(SELECT 1 FROM sync_worker_locks WHERE worker_name='telegram_channel_sync' AND lease_token=p_token AND locked_until>clock_timestamp())
  AND EXISTS(SELECT 1 FROM sync_events WHERE id=i.event_id AND status='processing' AND lease_token=p_token) THEN
  INSERT INTO channel_posts(entity_type,entity_id,channel_username,message_id,message_hash,status)
   VALUES(i.entity_type,i.entity_id,i.channel_username,p_message,i.message_hash,'active')
   ON CONFLICT(entity_type,entity_id,channel_username) DO UPDATE SET message_id=EXCLUDED.message_id,message_hash=EXCLUDED.message_hash,status='active',updated_at=clock_timestamp()
   WHERE channel_posts.status<>'active' OR channel_posts.message_id=EXCLUDED.message_id;
 END IF;
 -- Also covers late receipts, post-send visibility changes and duplicates.
 IF NOT EXISTS(SELECT 1 FROM sync_events WHERE entity_type=i.entity_type AND entity_id=i.entity_id AND status='pending') THEN
  INSERT INTO sync_events(entity_type,entity_id,action,payload) VALUES(i.entity_type,i.entity_id,'upsert','{}');
 END IF;
 RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_receipt_update(p_token uuid,p_event uuid,p_receipt uuid,p_status text,p_hash text DEFAULT NULL,p_snapshot jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e sync_events%ROWTYPE;r channel_delivery_receipts%ROWTYPE;s jsonb;
BEGIN
 PERFORM 1 FROM sync_worker_locks WHERE worker_name='telegram_channel_sync' AND lease_token=p_token AND locked_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel lease expired' USING ERRCODE='40001';END IF;
 SELECT * INTO e FROM sync_events WHERE id=p_event AND status='processing' AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel event expired' USING ERRCODE='40001';END IF;
 SELECT * INTO r FROM channel_delivery_receipts WHERE id=p_receipt AND entity_type=e.entity_type AND entity_id=e.entity_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_status IS NULL OR p_status NOT IN('active','deleted','redacted') THEN RAISE EXCEPTION 'Invalid receipt state' USING ERRCODE='22023';END IF;
 IF p_status='active' THEN
  s:=ishdasiz_channel_snapshot(e.entity_type,e.entity_id);
  IF p_snapshot IS NULL OR s IS DISTINCT FROM p_snapshot OR ishdasiz_channel_target(s) IS DISTINCT FROM r.channel_username
   OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Channel publication changed' USING ERRCODE='40001';END IF;
 END IF;
 UPDATE channel_delivery_receipts SET status=p_status,message_hash=CASE WHEN p_status='active' THEN p_hash ELSE message_hash END,updated_at=clock_timestamp() WHERE id=r.id;
 UPDATE channel_posts SET status=p_status,message_hash=CASE WHEN p_status='active' THEN p_hash ELSE message_hash END,updated_at=clock_timestamp()
  WHERE entity_type=e.entity_type AND entity_id=e.entity_id AND channel_username=r.channel_username AND message_id=r.message_id AND status='active';
 RETURN true;
END $$;

-- Protected operator API supplies a verified message ID, or explicitly records
-- that no post exists. Never use elapsed time alone as evidence of non-delivery.
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_resolve(p_intent uuid,p_expected_updated timestamptz,p_message bigint,p_not_delivered boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i channel_delivery_intents%ROWTYPE;
BEGIN
 PERFORM 1 FROM sync_worker_locks WHERE worker_name='telegram_channel_sync' FOR UPDATE;
 SELECT * INTO i FROM channel_delivery_intents WHERE id=p_intent FOR UPDATE;
 IF NOT FOUND OR i.status NOT IN('sending','uncertain') OR i.updated_at IS DISTINCT FROM p_expected_updated THEN RETURN false;END IF;
 IF i.created_at>clock_timestamp()-interval '5 minutes' OR EXISTS(SELECT 1 FROM sync_worker_locks WHERE worker_name='telegram_channel_sync' AND lease_token=i.lease_token AND locked_until>clock_timestamp()) THEN
  RAISE EXCEPTION 'Channel delivery is still in flight' USING ERRCODE='55000';END IF;
 IF p_not_delivered IS TRUE AND p_message IS NULL THEN
  UPDATE channel_delivery_intents SET status='rejected',resolution='Operator verified no post',updated_at=clock_timestamp() WHERE id=i.id;
 ELSIF p_not_delivered IS FALSE AND p_message IS NOT NULL THEN
  PERFORM ishdasiz_channel_send_result(i.lease_token,i.id,'confirmed',p_message);
  UPDATE channel_delivery_intents SET resolution='Operator verified message ID' WHERE id=i.id;
 ELSE RAISE EXCEPTION 'Invalid channel resolution' USING ERRCODE='22023';END IF;
 INSERT INTO sync_events(entity_type,entity_id,action,payload) VALUES(i.entity_type,i.entity_id,'upsert','{}');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_channel_copy_receipt(),public.ishdasiz_channel_target(jsonb),public.ishdasiz_channel_send_begin(uuid,uuid,text,jsonb,text),public.ishdasiz_channel_send_result(uuid,uuid,text,bigint),public.ishdasiz_channel_receipt_update(uuid,uuid,uuid,text,text,jsonb),public.ishdasiz_channel_resolve(uuid,timestamptz,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_channel_target(jsonb),public.ishdasiz_channel_send_begin(uuid,uuid,text,jsonb,text),public.ishdasiz_channel_send_result(uuid,uuid,text,bigint),public.ishdasiz_channel_receipt_update(uuid,uuid,uuid,text,text,jsonb),public.ishdasiz_channel_resolve(uuid,timestamptz,bigint,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_delivery_attention() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT count(*) FROM channel_delivery_intents WHERE status IN('sending','uncertain')
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_channel_delivery_attention() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_channel_delivery_attention() TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_seed_channel_sync(p_type text DEFAULT 'all',p_limit integer DEFAULT 200,p_after_type text DEFAULT NULL,p_after_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record; scanned integer:=0; jobs integer:=0; resumes integer:=0; added integer; last_type text; last_id uuid;
BEGIN
 IF p_type IS NULL OR p_type NOT IN('all','job','resume') OR p_limit IS NULL OR p_limit<1 OR p_limit>5000
  OR (p_after_type IS NULL)<>(p_after_id IS NULL) OR p_after_type NOT IN('job','resume') THEN
  RAISE EXCEPTION 'Invalid channel seed' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(1769174123);
 -- Include old posts even if their entity was deleted, hidden, moved or opted out.
 FOR item IN SELECT entity_type,entity_id FROM (
  SELECT 'job'::text entity_type,j.id entity_id FROM public.jobs j WHERE public.ishdasiz_job_available(j)
  UNION SELECT 'resume',r.id FROM public.resumes r WHERE public.ishdasiz_resume_channel_available(r)
  UNION SELECT c.entity_type,c.entity_id FROM public.channel_posts c WHERE c.status='active'
  UNION SELECT c.entity_type,c.entity_id FROM public.channel_delivery_receipts c WHERE c.status='active'
  UNION SELECT i.entity_type,i.entity_id FROM public.channel_delivery_intents i WHERE i.status IN('sending','uncertain')
 ) eligible WHERE (p_type='all' OR entity_type=p_type)
  AND (p_after_type IS NULL OR (entity_type,entity_id)>(p_after_type,p_after_id))
 ORDER BY entity_type,entity_id LIMIT p_limit LOOP
  scanned:=scanned+1;last_type:=item.entity_type;last_id:=item.entity_id;
  INSERT INTO public.sync_events(entity_type,entity_id,action,payload,status,next_retry_at)
   SELECT item.entity_type,item.entity_id,'upsert','{"reconcile":true}'::jsonb,'pending',clock_timestamp()
   WHERE NOT EXISTS(SELECT 1 FROM public.sync_events e WHERE e.entity_type=item.entity_type AND e.entity_id=item.entity_id AND e.status IN('pending','processing','failed'));
  GET DIAGNOSTICS added=ROW_COUNT;
  IF item.entity_type='job' THEN jobs:=jobs+added;ELSE resumes:=resumes+added;END IF;
 END LOOP;
 RETURN jsonb_build_object('scanned',scanned,'jobs',jobs,'resumes',resumes,'after_type',last_type,'after_id',last_id,'has_more',scanned=p_limit);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_seed_channel_sync(text,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_seed_channel_sync(text,integer,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
