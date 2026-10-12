-- Run only after deploying the current site and 33 schema migrations,
-- setting Production CRON_SECRET and the identical Vault secret,
-- and verifying channel delivery permissions with a test account.
BEGIN;
DO $activate$
DECLARE scheduled_job bigint; secret_value text; secret_count integer;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run scheduler setup as postgres'; END IF;
 SELECT count(*), min(decrypted_secret) INTO secret_count, secret_value
 FROM vault.decrypted_secrets WHERE name = 'ishdasiz_cron_secret';
 IF secret_count <> 1 OR secret_value IS NULL OR length(secret_value) < 32
    OR secret_value ~ '[[:space:][:cntrl:]]' THEN
  RAISE EXCEPTION 'Configure one valid ishdasiz_cron_secret in Vault';
 END IF;
 IF to_regprocedure('public.ishdasiz_channel_lease(uuid,text)') IS NULL
    OR to_regprocedure('public.ishdasiz_channel_claim(uuid)') IS NULL
    OR to_regprocedure('public.ishdasiz_schedule_channel_sync()') IS NULL THEN
  RAISE EXCEPTION 'Apply the channel release and install its inactive schedule first';
 END IF;
 SELECT jobid INTO STRICT scheduled_job FROM cron.job
 WHERE jobname = 'ishdasiz-channel-sync' AND username = current_user
   AND schedule = '*/5 * * * *'
   AND command = 'SELECT public.ishdasiz_schedule_channel_sync();';
 PERFORM cron.alter_job(scheduled_job, active := true);
END $activate$;
COMMIT;
