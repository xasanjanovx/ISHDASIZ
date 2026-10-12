-- Exact attached resume for the current employer, including a private active resume.
-- Does not publish resumes or retain snapshots after archive/account closure.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_application_resume(p_user_id uuid,p_session_version integer,p_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;candidate_id uuid;app public.job_applications%ROWTYPE;vacancy public.jobs%ROWTYPE;cv public.resumes%ROWTYPE;document jsonb;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0 OR p_application_id IS NULL THEN RAISE EXCEPTION 'Invalid application' USING ERRCODE='22023';END IF;
 SELECT user_id INTO candidate_id FROM public.job_applications WHERE id=p_application_id;
 -- Lock accounts before application/job/resume rows, in a deterministic order.
 PERFORM id FROM public.users WHERE id IN (p_user_id,candidate_id) ORDER BY id FOR SHARE;
 SELECT * INTO account FROM public.users WHERE id=p_user_id;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.employer_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employer unavailable' USING ERRCODE='42501';END IF;
 IF candidate_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=candidate_id AND closed_at IS NULL) THEN RETURN NULL;END IF;
 SELECT * INTO app FROM public.job_applications WHERE id=p_application_id FOR SHARE;
 IF NOT FOUND OR app.user_id IS DISTINCT FROM candidate_id OR app.resume_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO vacancy FROM public.jobs WHERE id=app.job_id FOR SHARE;
 IF NOT FOUND OR public.ishdasiz_job_owner(vacancy.employer_id,vacancy.user_id,vacancy.created_by) IS DISTINCT FROM p_user_id THEN RETURN NULL;END IF;
 SELECT * INTO cv FROM public.resumes WHERE id=app.resume_id AND user_id=app.user_id AND status='active' FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT jsonb_object_agg(key,value) INTO document FROM jsonb_each(to_jsonb(cv)) WHERE key=ANY(ARRAY[
  'id','status','title','desired_position','field_title','full_name','birth_date','phone','city','about','skills','experience','experience_years','experience_details',
  'education_level','education','languages','employment_type','gender','expected_salary_min','expected_salary_max',
  'category_id','category_ids','field_id','experience_level','region_id','district_id']);
 document:=document||jsonb_build_object(
  'regions',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.regions WHERE id=cv.region_id),
  'districts',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.districts WHERE id=cv.district_id AND (cv.region_id IS NULL OR region_id=cv.region_id)));
 RETURN jsonb_build_object('application_id',app.id,'resume',document);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_application_resume(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_application_resume(uuid,integer,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
