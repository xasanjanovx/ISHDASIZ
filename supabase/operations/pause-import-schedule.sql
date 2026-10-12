-- Pauses future calls; a request already sent can finish under the worker lease.
BEGIN;
DO $pause$
DECLARE scheduled_job bigint;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run scheduler setup as postgres'; END IF;
 FOR scheduled_job IN SELECT jobid FROM cron.job
  WHERE jobname = 'ishdasiz-osonish-refresh' AND username = current_user
 LOOP
  PERFORM cron.alter_job(scheduled_job, active := false);
 END LOOP;
END $pause$;
COMMIT;
