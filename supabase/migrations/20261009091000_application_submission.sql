-- Apply with the site and BOTH bots, after account_closure and public_job_availability.
-- Existing applications are retained. No legacy row is rewritten or removed.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_submit_application(p_user_id uuid,p_session_version integer,p_job_id uuid,p_resume_id uuid,p_phone text,p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;cv public.resumes%ROWTYPE;vacancy public.jobs%ROWTYPE;owner_id uuid;result public.job_applications%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_job_id IS NULL OR p_resume_id IS NULL OR p_phone IS NULL
  OR p_phone !~ '^\+998[0-9]{9}$' OR length(COALESCE(p_message,''))>4000 THEN RAISE EXCEPTION 'Invalid application' USING ERRCODE='22023';END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version IS DISTINCT FROM p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeker unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO cv FROM public.resumes WHERE id=p_resume_id AND user_id=p_user_id AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Resume unavailable' USING ERRCODE='P0002';END IF;
 SELECT * INTO vacancy FROM public.jobs WHERE id=p_job_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002';END IF;
 owner_id:=public.ishdasiz_job_owner(vacancy.employer_id,vacancy.user_id,vacancy.created_by);
 IF owner_id=p_user_id THEN RAISE EXCEPTION 'Own vacancy' USING ERRCODE='40001';END IF;
 IF owner_id IS NOT NULL THEN
  PERFORM 1 FROM public.users WHERE id=owner_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002';END IF;
 END IF;
 IF NOT public.ishdasiz_job_available(vacancy) OR vacancy.is_imported IS TRUE OR vacancy.source='osonish' THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='P0002';END IF;
 -- The locked applicant serializes submissions even when a legacy database has
 -- no unique index, and allows historical duplicates to remain untouched.
 IF EXISTS(SELECT 1 FROM public.job_applications WHERE job_id=p_job_id AND (user_id=p_user_id OR resume_id=p_resume_id)) THEN RAISE EXCEPTION 'Already applied' USING ERRCODE='23505';END IF;
 INSERT INTO public.job_applications(job_id,user_id,resume_id,full_name,phone,message,status)
  VALUES(p_job_id,p_user_id,p_resume_id,COALESCE(NULLIF(btrim(cv.full_name),''),account.phone),p_phone,NULLIF(btrim(p_message),''),'pending') RETURNING * INTO result;
 RETURN jsonb_build_object('id',result.id,'status',result.status,'created_at',result.created_at);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_submit_application(uuid,integer,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_submit_application(uuid,integer,uuid,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
