-- Read only the decision version actually shown to the seeker.
-- Apply after application_resume; preserves application and interview history.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_application_seen(
 p_user_id uuid,p_session_version integer,p_snapshots jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 account public.users%ROWTYPE;
 app public.job_applications%ROWTYPE;
 snapshot jsonb;
 seen jsonb:='[]'::jsonb;
 changed jsonb:='[]'::jsonb;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0
  OR p_snapshots IS NULL OR jsonb_typeof(p_snapshots)<>'array'
  OR jsonb_array_length(p_snapshots) NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'Invalid application receipt' USING ERRCODE='22023';
 END IF;
 FOR snapshot IN SELECT value FROM jsonb_array_elements(p_snapshots) LOOP
  IF jsonb_typeof(snapshot)<>'object' OR NOT snapshot ?& ARRAY['id','status','responded_at']
   OR jsonb_typeof(snapshot->'id')<>'string'
   OR (snapshot->>'id') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
   OR jsonb_typeof(snapshot->'status') NOT IN ('string','null')
   OR jsonb_typeof(snapshot->'status')='string' AND (snapshot->>'status') !~* '^[a-z_]{1,30}$'
   OR jsonb_typeof(snapshot->'responded_at') NOT IN ('string','null')
   OR jsonb_typeof(snapshot->'responded_at')='string' AND (snapshot->>'responded_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' THEN
   RAISE EXCEPTION 'Invalid application receipt' USING ERRCODE='22023';
  END IF;
  -- Validate real calendar dates before acquiring locks or changing any row.
  PERFORM (snapshot->>'responded_at')::timestamptz;
 END LOOP;
 IF (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(p_snapshots))<>jsonb_array_length(p_snapshots) THEN
  RAISE EXCEPTION 'Duplicate application receipt' USING ERRCODE='22023';
 END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR SHARE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version IS DISTINCT FROM p_session_version THEN
  RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeker unavailable' USING ERRCODE='42501';END IF;
 FOR snapshot IN SELECT value FROM jsonb_array_elements(p_snapshots) ORDER BY (value->>'id')::uuid LOOP
  SELECT * INTO app FROM public.job_applications WHERE id=(snapshot->>'id')::uuid AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application unavailable' USING ERRCODE='P0002';END IF;
  IF app.status IS NOT DISTINCT FROM (snapshot->>'status')
   AND app.responded_at IS NOT DISTINCT FROM (snapshot->>'responded_at')::timestamptz THEN
   IF app.is_seen_by_job_seeker IS DISTINCT FROM true THEN
    UPDATE public.job_applications SET is_seen_by_job_seeker=true WHERE id=app.id;
   END IF;
   seen:=seen||jsonb_build_array(app.id);
  ELSE
   changed:=changed||jsonb_build_array(app.id);
  END IF;
 END LOOP;
 RETURN jsonb_build_object('seen',seen,'changed',changed);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_application_seen(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_application_seen(uuid,integer,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
