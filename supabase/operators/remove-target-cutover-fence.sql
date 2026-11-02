-- Run only on the restored, unpublished server database. Keep the source fenced.
BEGIN;
DO $$
DECLARE t record;
BEGIN
  IF current_database()<>'restore_verify' THEN
    RAISE EXCEPTION 'Only the dedicated restored database may be unfenced by this operator';
  END IF;
  FOR t IN SELECT n.nspname,c.relname FROM pg_trigger g
    JOIN pg_class c ON c.oid=g.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE g.tgname='aaa_ishdasiz_cutover_write_fence'
      AND g.tgfoid='ishdasiz_cutover.reject_writes()'::regprocedure
  LOOP
    EXECUTE format('DROP TRIGGER aaa_ishdasiz_cutover_write_fence ON %I.%I',t.nspname,t.relname);
  END LOOP;
END;
$$;
DROP FUNCTION ishdasiz_cutover.reject_writes();
DROP TABLE ishdasiz_cutover.state;
DROP SCHEMA ishdasiz_cutover;
COMMIT;
