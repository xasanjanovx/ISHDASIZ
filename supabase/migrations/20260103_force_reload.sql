-- 1. Hack to force PostgREST to notice a DDL change
COMMENT ON TABLE public.jobs IS 'Jobs table structure refreshed';

-- 2. Standard reload command
NOTIFY pgrst, 'reload schema';

-- 3. Fix permissions for the VIEW (in case we need to fallback to it)
-- The 404 error on jobs_view was likely due to missing permissions for the API role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs_view TO anon, authenticated, service_role;
