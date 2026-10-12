-- Read-only pre/post-deployment inspection. Run in the Supabase SQL editor.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
    has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
    has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
    has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
    has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
    has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
    ('users','otp_codes','ai_sessions','telegram_sessions','conversations','messages','conversation_preferences',
     'resumes','employer_profiles','job_seeker_profiles','jobs','job_applications','favorites','view_history',
     'source_import_runs','job_import_state','source_import_visibility_pending','source_import_checkpoints','source_import_items')
ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT p.proname, p.prosecdef AS security_definer,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef ORDER BY p.proname;
