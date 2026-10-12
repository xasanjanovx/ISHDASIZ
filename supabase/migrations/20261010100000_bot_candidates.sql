-- Install after account_closure, public_job_availability and owned_resume_actions.
-- Service-only bot search and invitation writes. No weaker legacy fallback.
BEGIN;
-- Invitations are accessed by the server. Legacy table/column grants must not
-- allow browsers to bypass the transactional publication and ownership checks.
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_offers FROM PUBLIC,anon,authenticated;
DO $$ DECLARE col text; BEGIN
 FOR col IN SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='job_offers' LOOP
  EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.job_offers FROM PUBLIC,anon,authenticated',col,col,col,col);
 END LOOP;
END $$;
GRANT ALL ON TABLE public.job_offers TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_bot_candidate_card(r public.resumes, p_detail boolean)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(to_jsonb(r))
 WHERE key=ANY(ARRAY['id','user_id','status','is_public','found_job','full_name','title','field_id','field_title',
  'region_id','district_id','category_id','category_ids','expected_salary_min','expected_salary_max',
  'experience','experience_level','education_level','gender','birth_date'])
 OR (p_detail AND key=ANY(ARRAY['phone','telegram','about','skills','languages','special','experience_details','education']));
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_bot_candidate_card(public.resumes,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_bot_candidate_card(public.resumes,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_bot_candidates(
 p_user_id uuid,p_session_version integer,p_job_id uuid,p_region integer DEFAULT NULL,
 p_after_id uuid DEFAULT NULL,p_resume_id uuid DEFAULT NULL,p_page_size integer DEFAULT 200
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_user_id IS NULL OR p_job_id IS NULL OR p_session_version IS NULL OR p_session_version<0
  OR p_page_size IS NULL OR p_page_size<1 OR p_page_size>200 OR p_region<1 THEN
  RAISE EXCEPTION 'Invalid candidate search' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.closed_at IS NULL AND u.session_version=p_session_version)
  OR NOT EXISTS(SELECT 1 FROM public.employer_profiles e WHERE e.user_id=p_user_id)
  OR NOT EXISTS(SELECT 1 FROM public.jobs j WHERE j.id=p_job_id AND public.ishdasiz_job_available(j)
   AND public.ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by)=p_user_id) THEN
  RAISE EXCEPTION 'Employer vacancy unavailable' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT public.ishdasiz_bot_candidate_card(r,p_resume_id IS NOT NULL)
 FROM public.resumes r JOIN public.users u ON u.id=r.user_id AND u.closed_at IS NULL
 WHERE r.is_public IS TRUE AND r.status='active' AND r.found_job IS FALSE
  AND (p_region IS NULL OR r.region_id=p_region) AND (p_resume_id IS NULL OR r.id=p_resume_id)
  AND (p_after_id IS NULL OR r.id>p_after_id)
 ORDER BY r.id LIMIT p_page_size;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_bot_candidates(uuid,integer,uuid,integer,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_bot_candidates(uuid,integer,uuid,integer,uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_bot_create_offer(p_user_id uuid,p_session_version integer,p_job_id uuid,p_resume_id uuid,p_expected_seeker uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE recipient uuid; account public.users%ROWTYPE; vacancy public.jobs%ROWTYPE; cv public.resumes%ROWTYPE;
 offer public.job_offers%ROWTYPE; fresh boolean:=false;
BEGIN
 IF p_user_id IS NULL OR p_job_id IS NULL OR p_resume_id IS NULL OR p_expected_seeker IS NULL OR p_session_version IS NULL OR p_session_version<0 THEN
  RAISE EXCEPTION 'Invalid offer' USING ERRCODE='22023';END IF;
 SELECT user_id INTO recipient FROM public.resumes WHERE id=p_resume_id;
 IF recipient IS DISTINCT FROM p_expected_seeker OR recipient=p_user_id THEN RAISE EXCEPTION 'Candidate unavailable' USING ERRCODE='42501';END IF;
 -- Serialize invitations by account and lock both accounts before their publications,
 -- in the same order for concurrent employers and account closure.
 PERFORM 1 FROM public.users WHERE id IN(p_user_id,recipient) ORDER BY id FOR UPDATE;
 SELECT * INTO account FROM public.users WHERE id=p_user_id;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version IS DISTINCT FROM p_session_version
  OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=recipient AND closed_at IS NULL) THEN
  RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.employer_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employer unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO vacancy FROM public.jobs WHERE id=p_job_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vacancy unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.employer_profiles WHERE id=vacancy.employer_id FOR SHARE;
 IF public.ishdasiz_job_owner(vacancy.employer_id,vacancy.user_id,vacancy.created_by) IS DISTINCT FROM p_user_id
  OR NOT public.ishdasiz_job_available(vacancy) THEN RAISE EXCEPTION 'Vacancy unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO cv FROM public.resumes WHERE id=p_resume_id FOR SHARE;
 IF NOT FOUND OR cv.user_id IS DISTINCT FROM recipient OR cv.status IS DISTINCT FROM 'active'
  OR cv.is_public IS NOT TRUE OR cv.found_job IS NOT FALSE THEN RAISE EXCEPTION 'Candidate unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO offer FROM public.job_offers WHERE job_id=p_job_id AND resume_id=p_resume_id
  AND employer_user_id=p_user_id AND seeker_user_id=recipient AND status IN('sent','pending') ORDER BY created_at,id LIMIT 1;
 IF NOT FOUND THEN
  INSERT INTO public.job_offers(job_id,resume_id,employer_user_id,seeker_user_id,status)
   VALUES(p_job_id,p_resume_id,p_user_id,recipient,'sent') RETURNING * INTO offer;
  fresh:=true;
 END IF;
 RETURN jsonb_build_object('id',offer.id,'resume_id',cv.id,'seeker_user_id',recipient,'created',fresh,
  'job',jsonb_build_object('id',vacancy.id,'title_uz',to_jsonb(vacancy)->>'title_uz',
   'title_ru',to_jsonb(vacancy)->>'title_ru','title',to_jsonb(vacancy)->>'title','company_name',to_jsonb(vacancy)->>'company_name'));
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_bot_create_offer(uuid,integer,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_bot_create_offer(uuid,integer,uuid,uuid,uuid) TO service_role;
CREATE INDEX IF NOT EXISTS resumes_bot_candidates_idx ON public.resumes(region_id,id)
 WHERE is_public IS TRUE AND status='active' AND found_job IS FALSE;
NOTIFY pgrst,'reload schema';
COMMIT;
