-- Source-only operational fence. Installation leaves writes enabled.
-- Enable only after the destination and rollback path have been checked.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
CREATE SCHEMA ishdasiz_cutover;
REVOKE ALL ON SCHEMA ishdasiz_cutover FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE ishdasiz_cutover.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO ishdasiz_cutover.state VALUES(true,false);
REVOKE ALL ON ishdasiz_cutover.state FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION ishdasiz_cutover.reject_writes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF coalesce((SELECT enabled FROM ishdasiz_cutover.state WHERE singleton),true) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Database migration in progress. Please retry shortly.';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION ishdasiz_cutover.reject_writes() FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT n.nspname,c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN('public','auth','storage') AND c.relkind IN('r','p')
      -- Managed provider migration/vector metadata is not application data.
      AND (n.nspname,c.relname) NOT IN (
        ('auth','schema_migrations'),('storage','migrations'),
        ('storage','buckets_vectors'),('storage','vector_indexes'))
      -- Historical SELF-bot tables are outside the ISHDASIZ writer boundary.
      AND NOT (n.nspname='public' AND c.relname LIKE 'bot\_%' ESCAPE '\')
    ORDER BY n.nspname,c.relname
  LOOP
    EXECUTE format('CREATE TRIGGER aaa_ishdasiz_cutover_write_fence BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION ishdasiz_cutover.reject_writes()',t.nspname,t.relname);
  END LOOP;
END;
$$;
COMMIT;
