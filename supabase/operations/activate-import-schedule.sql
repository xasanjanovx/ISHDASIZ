-- Run only after deploying the candidate importer and its migration,
-- setting Production CRON_SECRET and the identical Vault secret,
-- and verifying the protected continuation endpoint. No Telegram delivery.
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
 IF to_regprocedure('public.ishdasiz_finish_osonish_refresh(uuid,uuid)') IS NULL
    OR to_regprocedure('public.ishdasiz_osonish_candidates(uuid,uuid,integer,text[],integer,integer)') IS NULL
    OR to_regprocedure('public.ishdasiz_schedule_osonish_refresh()') IS NULL THEN
  RAISE EXCEPTION 'Apply the candidate import release and install its inactive schedule first';
 END IF;
 SELECT jobid INTO STRICT scheduled_job FROM cron.job
 WHERE jobname = 'ishdasiz-osonish-refresh' AND username = current_user
   AND schedule = '*/5 * * * *'
   AND command = 'SELECT public.ishdasiz_schedule_osonish_refresh();';
 PERFORM cron.alter_job(scheduled_job, active := true);
END $activate$;
COMMIT;
