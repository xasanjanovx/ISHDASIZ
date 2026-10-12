-- Read-only metadata audit for the October release. No application rows,
-- passwords, OTPs, auth tokens or migration statement bodies are returned.
-- A successful audit is NOT authorization to apply migrations.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_setting('server_version') AS postgres_version;

SELECT required.table_name, to_regclass('public.' || required.table_name) IS NOT NULL AS exists
FROM unnest(ARRAY['users','otp_codes','telegram_sessions','job_seeker_profiles','employer_profiles','jobs','resumes',
 'job_applications','favorites','view_history','conversations','messages','regions','districts','categories',
 'admin_profiles','job_offers','job_auto_matches','channel_posts','sync_events','sync_worker_locks']) AS required(table_name)
ORDER BY required.table_name;

-- Missing or incompatible baseline columns require investigation before release.
WITH required(table_name,column_name,expected_type) AS (VALUES
 ('users','id','uuid'),('users','password_hash','text'),('users','phone','text'),
 ('jobs','id','uuid'),('jobs','employer_id','uuid'),('jobs','user_id','uuid'),('jobs','created_by','uuid'),
 ('jobs','region_id','integer'),('jobs','district_id','integer'),('jobs','category_id','uuid'),
 ('jobs','source','text'),('jobs','source_id','text'),('jobs','source_status','text'),('jobs','is_imported','boolean'),
 ('jobs','status','text'),('jobs','is_active','boolean'),('jobs','updated_at','timestamp with time zone'),
 ('resumes','id','uuid'),('resumes','user_id','uuid'),('resumes','is_public','boolean'),('resumes','status','text'),
 ('resumes','post_to_channel','boolean'),('resumes','updated_at','timestamp with time zone'),
 ('resumes','category_id','uuid'),('resumes','region_id','integer'),('resumes','district_id','integer'),
 ('regions','id','integer'),('districts','id','integer'),('districts','region_id','integer'),('categories','id','uuid'),
 ('job_applications','id','uuid'),('job_applications','user_id','uuid'),('job_applications','resume_id','uuid'),
 ('conversations','user1_id','uuid'),('conversations','user2_id','uuid'),('messages','conversation_id','uuid'),('messages','sender_id','uuid'),
 ('job_offers','id','uuid'),('job_offers','job_id','uuid'),('job_offers','resume_id','uuid'),
 ('job_offers','employer_user_id','uuid'),('job_offers','seeker_user_id','uuid'),('job_offers','status','text'),('job_offers','message','text'),
 ('job_offers','seen_at','timestamp with time zone'),('job_offers','created_at','timestamp with time zone')
)
SELECT r.*,c.data_type AS actual_type,
 CASE WHEN c.column_name IS NULL AND r.table_name='resumes' AND r.column_name='post_to_channel' THEN 'added_by_release'
 WHEN c.column_name IS NULL THEN 'missing'
 WHEN (r.table_name='resumes' AND r.column_name='region_id' AND c.data_type='bigint') THEN 'compatible_bigint'
 WHEN c.data_type=r.expected_type OR (r.expected_type='text' AND c.data_type='character varying') THEN 'compatible'
 ELSE 'review_type' END AS result
FROM required r LEFT JOIN information_schema.columns c ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
ORDER BY r.table_name,r.column_name;

-- Shows history only when its relation exists; manual SQL-editor changes may
-- not appear in this history, so also compare schema/functions and deployment logs.
DO $audit_history$
DECLARE history jsonb; duplicate_groups bigint;
BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  RAISE NOTICE 'migration_history: unavailable';
 ELSE
  EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''version'',to_jsonb(m)->>''version'',''name'',to_jsonb(m)->>''name'') ORDER BY to_jsonb(m)->>''version''),''[]''::jsonb) FROM supabase_migrations.schema_migrations m' INTO history;
  RAISE NOTICE 'migration_history: %',history;
 END IF;
 IF to_regclass('public.channel_posts') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM (SELECT channel_username,message_id FROM public.channel_posts GROUP BY channel_username,message_id HAVING count(*)>1) d' INTO duplicate_groups;
  RAISE NOTICE 'channel_receipt_duplicate_groups: % (must be reviewed before the delivery migration)',duplicate_groups;
 END IF;
END;
$audit_history$;

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
 has_any_column_privilege('anon',c.oid,'SELECT') AS anon_column_select,
 has_any_column_privilege('authenticated',c.oid,'SELECT') AS authenticated_column_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('users','otp_codes','telegram_sessions','ai_sessions','conversations','messages','favorites','view_history','admin_profiles','job_auto_matches','channel_delivery_intents','channel_delivery_receipts')
ORDER BY c.relname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 p.prosecdef AS security_definer,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'ishdasiz_%'
ORDER BY p.proname,arguments;
COMMIT;
