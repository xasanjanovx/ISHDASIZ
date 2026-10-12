-- Full catalog CVs require a current account; anonymous catalog cards stay available.
BEGIN;
DROP POLICY IF EXISTS ishdasiz_resume_detail_private ON public.resumes;
CREATE POLICY ishdasiz_resume_detail_private ON public.resumes AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(current_user='authenticated' AND user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.ishdasiz_catalog_resume(p_user_id uuid,p_session_version integer,p_resume_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;candidate_id uuid;cv public.resumes%ROWTYPE;document jsonb;handle text;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0 OR p_resume_id IS NULL THEN RAISE EXCEPTION 'Invalid resume' USING ERRCODE='22023';END IF;
 SELECT user_id INTO candidate_id FROM public.resumes WHERE id=p_resume_id;
 PERFORM id FROM public.users WHERE id IN(p_user_id,candidate_id) ORDER BY id FOR SHARE;
 SELECT * INTO account FROM public.users WHERE id=p_user_id;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 IF candidate_id IS DISTINCT FROM p_user_id THEN
  PERFORM 1 FROM public.employer_profiles WHERE user_id=p_user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employer required' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO cv FROM public.resumes WHERE id=p_resume_id FOR SHARE;
 IF NOT FOUND OR cv.user_id IS DISTINCT FROM candidate_id OR NOT public.ishdasiz_resume_available(cv) THEN RETURN NULL;END IF;
 SELECT jsonb_object_agg(key,value) INTO document FROM jsonb_each(to_jsonb(cv)) WHERE key=ANY(ARRAY[
  'id','title','desired_position','field_title','full_name','birth_date','phone','city','about','skills','experience','experience_years','experience_details',
  'education_level','education','languages','employment_type','gender','expected_salary_min','expected_salary_max','created_at']);
 SELECT coalesce(nullif(btrim(to_jsonb(p)->>'telegram'),''),nullif(btrim(to_jsonb(cv)->>'telegram'),'')) INTO handle FROM public.job_seeker_profiles p WHERE p.user_id=cv.user_id;
 handle:=coalesce(handle,to_jsonb(cv)->>'telegram');
 document:=document||jsonb_build_object('user_id',cv.user_id,'telegram',CASE WHEN ltrim(handle,'@')~'^[A-Za-z][A-Za-z0-9_]{4,31}$' THEN ltrim(handle,'@') ELSE NULL END,
  'regions',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.regions WHERE id=cv.region_id),
  'districts',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.districts WHERE id=cv.district_id AND(cv.region_id IS NULL OR region_id=cv.region_id)));
 RETURN document;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_catalog_resume(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_catalog_resume(uuid,integer,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
