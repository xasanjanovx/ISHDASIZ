-- Apply with the server-backed account APIs, never ahead of the matching site.
-- Browser clients read only public vacancies/references. Account/CV/contact and
-- mutation access passes through the site's verified account APIs.
-- Forward-only access tightening; rollback is the previous backend/release.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';

-- Preserve exactly the service role's existing effective access before taking
-- away PUBLIC grants. In particular, never expose private lease/mutation helpers
-- that were already denied to service_role.
DO $preserve$
DECLARE item record; privilege text;
BEGIN
 FOR item IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f') LOOP
  FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
   IF has_table_privilege('service_role',item.oid,privilege) THEN
    EXECUTE format('GRANT %s ON TABLE %I.%I TO service_role',privilege,item.nspname,item.relname);
   END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT c.oid,n.nspname,c.relname,a.attname,a.attnum FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL LOOP
  FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
   IF NOT has_table_privilege('service_role',item.oid,privilege)
    AND has_column_privilege('service_role',item.oid,item.attnum,privilege) THEN
    EXECUTE format('GRANT %s(%I) ON TABLE %I.%I TO service_role',privilege,item.attname,item.nspname,item.relname);
   END IF;
   EXECUTE format('REVOKE %s(%I) ON TABLE %I.%I FROM PUBLIC,anon,authenticated',privilege,item.attname,item.nspname,item.relname);
  END LOOP;
 END LOOP;
 FOR item IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='S' LOOP
  FOREACH privilege IN ARRAY ARRAY['USAGE','SELECT','UPDATE'] LOOP
   IF has_sequence_privilege('service_role',item.oid,privilege) THEN
    EXECUTE format('GRANT %s ON SEQUENCE %I.%I TO service_role',privilege,item.nspname,item.relname);
   END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT p.oid,p.oid::regprocedure AS signature FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP
  IF has_function_privilege('service_role',item.oid,'EXECUTE') THEN
   EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO service_role',item.signature);
  END IF;
 END LOOP;
END
$preserve$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.jobs,public.categories,public.regions,public.districts TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_job_available(public.jobs),
 public.ishdasiz_job_owner(uuid,uuid,uuid),public.ishdasiz_account_open(uuid),
 public.ishdasiz_public_home_counts(),public.ishdasiz_public_job_counts(integer,integer) TO anon,authenticated;

-- Old owner/self-service policies can reference private profile tables. The
-- matching site uses server APIs for those operations; direct browser reads
-- should have one explicit public-vacancy rule with no private-table joins.
DO $policies$
DECLARE item record;
BEGIN
 FOR item IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND cmd IN('ALL','SELECT') LOOP
  EXECUTE format('DROP POLICY %I ON public.jobs',item.policyname);
 END LOOP;
END
$policies$;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ishdasiz_browser_public_jobs ON public.jobs FOR SELECT TO anon,authenticated
 USING(public.ishdasiz_job_available(jobs));
NOTIFY pgrst,'reload schema';
COMMIT;
