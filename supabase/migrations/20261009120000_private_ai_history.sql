-- AI search now keeps validated conversation state in its browser tab.
-- Preserve legacy records, but never expose them through the public REST API.
BEGIN;
DO $$
DECLARE item record;
BEGIN
  IF to_regclass('public.ai_sessions') IS NOT NULL THEN
    ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.ai_sessions FROM PUBLIC, anon, authenticated;
    -- Table revocation alone does not remove legacy column grants.
    FOR item IN SELECT attname FROM pg_attribute
      WHERE attrelid = 'public.ai_sessions'::regclass AND attnum > 0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.ai_sessions FROM PUBLIC, anon, authenticated', item.attname);
    END LOOP;
    FOR item IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_sessions'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.ai_sessions', item.policyname);
    END LOOP;
    GRANT ALL ON TABLE public.ai_sessions TO service_role;
  END IF;
  IF to_regprocedure('public.cleanup_expired_ai_sessions()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.cleanup_expired_ai_sessions() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.cleanup_expired_ai_sessions() TO service_role;
  END IF;
END $$;
COMMIT;
