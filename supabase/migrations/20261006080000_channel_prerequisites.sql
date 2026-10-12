-- Missing legacy channel prerequisites, confirmed by the read-only project audit.
-- No job/resume/account rows are changed. Existing receipts, events and locks survive.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'resume')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'deactivate', 'delete')),
  region_id BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_status_next_retry
  ON public.sync_events(status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_sync_events_entity
  ON public.sync_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.channel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'resume')),
  entity_id UUID NOT NULL,
  channel_username TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  message_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, channel_username)
);

CREATE INDEX IF NOT EXISTS idx_channel_posts_entity
  ON public.channel_posts(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.sync_worker_locks (
  worker_name TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


DO $bootstrap$ BEGIN
 IF to_regprocedure('public.acquire_worker_lock(text,integer)') IS NULL THEN
  EXECUTE $definition$CREATE FUNCTION public.acquire_worker_lock(
  p_name TEXT,
  p_ttl_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO sync_worker_locks(worker_name, locked_until, updated_at)
  VALUES (p_name, v_now + make_interval(secs => GREATEST(30, p_ttl_seconds)), v_now)
  ON CONFLICT (worker_name)
  DO UPDATE SET
    locked_until = EXCLUDED.locked_until,
    updated_at = EXCLUDED.updated_at
  WHERE sync_worker_locks.locked_until IS NULL
    OR sync_worker_locks.locked_until < v_now;

  RETURN FOUND;
END;
$$;$definition$;
 END IF;
END $bootstrap$;
DO $bootstrap$ BEGIN
 IF to_regprocedure('public.release_worker_lock(text)') IS NULL THEN
  EXECUTE $definition$CREATE FUNCTION public.release_worker_lock(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
BEGIN
  UPDATE sync_worker_locks
  SET locked_until = now(),
      updated_at = now()
  WHERE worker_name = p_name;
END;
$$;$definition$;
 END IF;
END $bootstrap$;
DO $permissions$ DECLARE tbl text; col text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['sync_events','channel_posts','sync_worker_locks'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.%I FROM PUBLIC,anon,authenticated',col,col,col,col,tbl);
  END LOOP;
  EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',tbl);
 END LOOP;
END $permissions$;
REVOKE ALL ON FUNCTION public.acquire_worker_lock(text,integer),public.release_worker_lock(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_worker_lock(text,integer),public.release_worker_lock(text) TO service_role;
COMMIT;
