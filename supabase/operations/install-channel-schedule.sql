-- Run as postgres after enabling pg_cron and pg_net in Supabase Extensions.
-- This installs an INACTIVE schedule. No secret literal and no HTTP call here.
-- Not a schema migration: activate separately after the coordinated release.
BEGIN;
DO $prerequisites$
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run scheduler setup as postgres'; END IF;
 IF to_regprocedure('cron.schedule(text,text,text)') IS NULL
    OR to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') IS NULL
    OR to_regclass('vault.decrypted_secrets') IS NULL THEN
  RAISE EXCEPTION 'Enable Supabase pg_cron, pg_net and Vault before scheduler setup';
 END IF;
END $prerequisites$;

CREATE OR REPLACE FUNCTION public.ishdasiz_schedule_channel_sync()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
DECLARE secret_value text; secret_count integer;
BEGIN
 SELECT count(*), min(decrypted_secret) INTO secret_count, secret_value
 FROM vault.decrypted_secrets WHERE name = 'ishdasiz_cron_secret';
 IF secret_count <> 1 OR secret_value IS NULL OR length(secret_value) < 32
    OR secret_value ~ '[[:space:][:cntrl:]]' THEN
  RAISE EXCEPTION 'Configure one valid ishdasiz_cron_secret in Vault';
 END IF;
 RETURN net.http_get(
  url := 'https://ishdasiz.uz/api/cron/sync-telegram-channels',
  headers := jsonb_build_object('Authorization', 'Bearer ' || secret_value),
  timeout_milliseconds := 300000
 );
END $function$;
REVOKE ALL ON FUNCTION public.ishdasiz_schedule_channel_sync() FROM PUBLIC, anon, authenticated, service_role;

DO $schedule$
DECLARE scheduled_job bigint;
BEGIN
 scheduled_job := cron.schedule('ishdasiz-channel-sync', '*/5 * * * *',
  'SELECT public.ishdasiz_schedule_channel_sync();');
 PERFORM cron.alter_job(scheduled_job, active := false);
END $schedule$;
COMMIT;
