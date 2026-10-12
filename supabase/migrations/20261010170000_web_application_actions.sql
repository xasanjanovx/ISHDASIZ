-- Apply after the invitation release. Preserve the website status choices.
-- Account, current canonical owner and exact decision version are checked under row locks.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_web_application_action(
 p_user_id uuid,p_session_version integer,p_application_id uuid,p_action text,
 p_status text DEFAULT NULL,p_expected_status text DEFAULT NULL,p_expected_responded_at timestamptz DEFAULT NULL,p_details jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;app public.job_applications%ROWTYPE;vacancy public.jobs%ROWTYPE;stamp timestamptz;item record;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_application_id IS NULL OR p_action IS NULL
  OR p_action NOT IN ('view','status')
  OR p_action='status' AND (p_status IS NULL OR p_status NOT IN ('pending','reviewed','interview_set','accepted','rejected','hired'))
  OR p_details IS NULL OR jsonb_typeof(p_details)<>'object' THEN RAISE EXCEPTION 'Invalid application action' USING ERRCODE='22023';END IF;
 FOR item IN SELECT key,value FROM jsonb_each(p_details) LOOP
  IF item.key NOT IN ('employer_phone','employer_message','interview_date','interview_address','rejection_reason')
   OR jsonb_typeof(item.value) NOT IN ('string','null') OR length(COALESCE(p_details->>item.key,''))>4000 THEN
   RAISE EXCEPTION 'Invalid application details' USING ERRCODE='22023';END IF;
 END LOOP;
 IF length(COALESCE(p_details->>'employer_phone',''))>40
  OR length(COALESCE(p_details->>'interview_date',''))>64
  OR length(COALESCE(p_details->>'interview_address',''))>1000 THEN RAISE EXCEPTION 'Invalid application details' USING ERRCODE='22023';END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version IS DISTINCT FROM p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.employer_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employer unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO app FROM public.job_applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application unavailable' USING ERRCODE='P0002';END IF;
 SELECT * INTO vacancy FROM public.jobs WHERE id=app.job_id FOR SHARE;
 IF NOT FOUND OR public.ishdasiz_job_owner(vacancy.employer_id,vacancy.user_id,vacancy.created_by) IS DISTINCT FROM p_user_id THEN
  RAISE EXCEPTION 'Application unavailable' USING ERRCODE='42501';END IF;
 IF p_action='view' THEN
  UPDATE public.job_applications SET viewed_at=COALESCE(viewed_at,clock_timestamp()),
   status=CASE WHEN status='pending' THEN 'reviewed' ELSE status END
   WHERE id=app.id RETURNING * INTO app;
 ELSE
  IF app.status IS DISTINCT FROM p_expected_status OR app.responded_at IS DISTINCT FROM p_expected_responded_at THEN
   RAISE EXCEPTION 'Application changed' USING ERRCODE='40001';END IF;
  IF NULLIF(btrim(p_details->>'interview_date'),'') IS NOT NULL AND (p_details->>'interview_date') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' THEN
   RAISE EXCEPTION 'Invalid interview date' USING ERRCODE='22023';END IF;
  IF p_status='interview_set' AND NULLIF(btrim(p_details->>'interview_date'),'') IS NULL THEN
   RAISE EXCEPTION 'Interview date required' USING ERRCODE='22023';END IF;
  IF app.status=p_status AND p_details='{}'::jsonb THEN
   RETURN jsonb_build_object('id',app.id,'status',app.status,'responded_at',app.responded_at,'viewed_at',app.viewed_at);
  END IF;
  stamp:=GREATEST(clock_timestamp(),COALESCE(app.responded_at,'-infinity'::timestamptz)+interval '1 microsecond');
  UPDATE public.job_applications SET status=p_status,responded_at=stamp,is_seen_by_job_seeker=false,
   viewed_at=COALESCE(viewed_at,stamp),
   employer_phone=CASE WHEN p_details?'employer_phone' THEN NULLIF(btrim(p_details->>'employer_phone'),'') ELSE employer_phone END,
   employer_message=CASE WHEN p_details?'employer_message' THEN NULLIF(btrim(p_details->>'employer_message'),'') ELSE employer_message END,
   interview_date=CASE WHEN p_details?'interview_date' THEN NULLIF(btrim(p_details->>'interview_date'),'')::timestamptz ELSE interview_date END,
   interview_address=CASE WHEN p_details?'interview_address' THEN NULLIF(btrim(p_details->>'interview_address'),'') ELSE interview_address END,
   rejection_reason=CASE WHEN p_details?'rejection_reason' THEN NULLIF(btrim(p_details->>'rejection_reason'),'') ELSE rejection_reason END
   WHERE id=app.id RETURNING * INTO app;
 END IF;
 RETURN jsonb_build_object('id',app.id,'job_id',app.job_id,'user_id',app.user_id,'resume_id',app.resume_id,
  'status',app.status,'responded_at',app.responded_at,'viewed_at',app.viewed_at,
  'interview_date',app.interview_date,'interview_address',app.interview_address,
  'employer_phone',app.employer_phone,'employer_message',app.employer_message,'rejection_reason',app.rejection_reason);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_web_application_action(uuid,integer,uuid,text,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_web_application_action(uuid,integer,uuid,text,text,text,timestamptz,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
