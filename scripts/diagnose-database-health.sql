-- One-off metadata-only diagnostic for Supabase SQL Editor / a SQL connection.
-- No business rows, query text, connection strings, cron commands or secrets.
-- Does not cancel work, restart the project, change settings or apply migrations.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='1s';

SELECT now() AS sampled_at,current_database() AS database,
 numbackends,xact_commit,xact_rollback,blks_read,blks_hit,
 round(100.0*blks_hit/nullif(blks_hit+blks_read,0),2) AS cache_hit_percent,
 temp_files,temp_bytes,deadlocks,blk_read_time,blk_write_time,stats_reset
FROM pg_stat_database WHERE datname=current_database();

SELECT backend_type,state,wait_event_type,wait_event,count(*) AS connections,
 max(now()-xact_start) AS oldest_transaction,
 max(now()-query_start) FILTER(WHERE state='active') AS longest_active
FROM pg_stat_activity WHERE datname=current_database()
GROUP BY backend_type,state,wait_event_type,wait_event
ORDER BY connections DESC;

SELECT pid,backend_type,state,wait_event_type,wait_event,
 now()-xact_start AS transaction_age,now()-query_start AS query_age,
 pg_blocking_pids(pid) AS blocking_pids
FROM pg_stat_activity
WHERE datname=current_database() AND pid<>pg_backend_pid()
 AND (cardinality(pg_blocking_pids(pid))>0 OR xact_start<now()-interval '1 minute')
ORDER BY xact_start NULLS LAST LIMIT 30;

SELECT relname,n_live_tup,n_dead_tup,n_mod_since_analyze,seq_scan,idx_scan,
 last_autovacuum,last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 25;

SELECT name,setting,unit,source FROM pg_settings
WHERE name IN('max_connections','shared_buffers','work_mem','statement_timeout',
 'idle_in_transaction_session_timeout','effective_cache_size','autovacuum');

-- Emit top normalized query IDs and function names; never emit query text.
DO $health$
DECLARE statements regclass;report jsonb;
BEGIN
 statements:=COALESCE(to_regclass('extensions.pg_stat_statements'),to_regclass('public.pg_stat_statements'));
 IF statements IS NOT NULL THEN
  EXECUTE format($query$
   SELECT jsonb_agg(to_jsonb(s)) FROM (
    SELECT queryid::text AS query_id,calls,round(total_exec_time::numeric,1) AS total_ms,
     round(mean_exec_time::numeric,1) AS mean_ms,rows,
     shared_blks_hit,shared_blks_read,temp_blks_written,
     substring(query FROM '(ishdasiz_[a-z0-9_]+)[[:space:]]*\(') AS application_function
    FROM %s ORDER BY total_exec_time DESC LIMIT 15
   ) s$query$,statements) INTO report;
  RAISE NOTICE 'top_statement_metadata: %',report;
 END IF;
 IF to_regclass('cron.job') IS NOT NULL THEN
  EXECUTE 'SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT jobid,jobname,schedule,active FROM cron.job ORDER BY jobid) s' INTO report;
  RAISE NOTICE 'schedule_metadata: %',report;
 END IF;
END $health$;
COMMIT;
