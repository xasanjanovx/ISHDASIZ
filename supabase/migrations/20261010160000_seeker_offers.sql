-- Recipient-scoped invitation history shared by site and both bot transports.
-- Retains historical invitations, responses and notification timestamps.
BEGIN;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_offers FROM PUBLIC,anon,authenticated;
DO $$ DECLARE col text; BEGIN
 FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='job_offers' LOOP
  EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.job_offers FROM PUBLIC,anon,authenticated',col,col,col,col);
 END LOOP;
END $$;
GRANT ALL ON public.job_offers TO service_role;
CREATE INDEX IF NOT EXISTS ishdasiz_seeker_offer_page ON public.job_offers(seeker_user_id,created_at DESC NULLS LAST,id DESC);

CREATE OR REPLACE FUNCTION public.ishdasiz_offer_job_available(public.job_offers,public.jobs)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT $2.id IS NOT NULL AND $2.id=$1.job_id AND $1.employer_user_id IS NOT NULL
  AND public.ishdasiz_job_owner($2.employer_id,$2.user_id,$2.created_by) IS NOT DISTINCT FROM $1.employer_user_id
  AND public.ishdasiz_job_available($2);
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_offer_job_available(public.job_offers,public.jobs) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_offer_job_available(public.job_offers,public.jobs) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_seeker_offers(
 p_user_id uuid,p_session_version integer,p_after_created timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL,p_page_size integer DEFAULT 10
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;result jsonb;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50
  OR (p_after_created IS NOT NULL AND p_after_id IS NULL) THEN RAISE EXCEPTION 'Invalid invitation page' USING ERRCODE='22023';END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR SHARE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeker unavailable' USING ERRCODE='42501';END IF;
 WITH selected AS MATERIALIZED (
  SELECT o AS invitation FROM public.job_offers o WHERE o.seeker_user_id=p_user_id
   AND (p_after_id IS NULL OR (p_after_created IS NULL AND o.created_at IS NULL AND o.id<p_after_id)
    OR (p_after_created IS NOT NULL AND (o.created_at<p_after_created OR (o.created_at=p_after_created AND o.id<p_after_id) OR o.created_at IS NULL)))
  ORDER BY o.created_at DESC NULLS LAST,o.id DESC LIMIT p_page_size+1
 ), numbered AS (SELECT invitation,row_number() OVER(ORDER BY (invitation).created_at DESC NULLS LAST,(invitation).id DESC) AS ordinal FROM selected),
 cards AS (
  SELECT n.ordinal,jsonb_build_object('id',(n.invitation).id,'job_id',(n.invitation).job_id,'seeker_user_id',(n.invitation).seeker_user_id,'status',(n.invitation).status,'created_at',(n.invitation).created_at,'seen_at',(n.invitation).seen_at,
   'job_available',public.ishdasiz_offer_job_available(n.invitation,j),
   'job',CASE WHEN public.ishdasiz_offer_job_available(n.invitation,j) THEN jsonb_build_object('id',j.id,'title_uz',j.title_uz,'title_ru',j.title_ru,'company_name',j.company_name) ELSE NULL END) AS card
  FROM numbered n LEFT JOIN public.jobs j ON j.id=(n.invitation).job_id WHERE n.ordinal<=p_page_size
 ) SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(card ORDER BY ordinal) FROM cards),'[]'::jsonb),
  'next_cursor',CASE WHEN (SELECT count(*) FROM selected)>p_page_size THEN
   (SELECT jsonb_build_object('id',(invitation).id,'created_at',(invitation).created_at) FROM numbered WHERE ordinal=p_page_size) ELSE NULL END) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_seeker_offers(uuid,integer,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_seeker_offers(uuid,integer,timestamptz,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_seeker_offer(p_user_id uuid,p_session_version integer,p_offer_id uuid DEFAULT NULL,p_job_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;offer public.job_offers%ROWTYPE;vacancy public.jobs%ROWTYPE;cv public.resumes%ROWTYPE;
 available boolean:=false;job_json jsonb:=NULL;resume_json jsonb:=NULL;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0 OR (p_offer_id IS NULL)=(p_job_id IS NULL) THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023';END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR SHARE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeker unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO offer FROM public.job_offers WHERE seeker_user_id=p_user_id
  AND (p_offer_id IS NULL OR id=p_offer_id) AND (p_job_id IS NULL OR job_id=p_job_id)
  ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO vacancy FROM public.jobs WHERE id=offer.job_id FOR SHARE;
 IF FOUND THEN available:=public.ishdasiz_offer_job_available(offer,vacancy);END IF;
 IF available THEN
  -- Explicit allowlist: unexpected future/private job columns cannot escape.
  SELECT jsonb_object_agg(key,value) INTO job_json FROM jsonb_each(to_jsonb(vacancy)) WHERE key=ANY(ARRAY[
   'id','title','title_uz','title_ru','description_uz','description_ru','company_name','category_id','category_ids','field_id','field_title',
   'salary_min','salary_max','employment_type','region_id','district_id','address','latitude','longitude','contact_phone','phone','contact_email','contact_telegram','hr_name',
   'requirements_uz','requirements_ru','benefits','experience','education_level','gender','age_min','age_max','skills','languages','payment_type','work_mode','working_days','working_hours',
   'is_for_students','is_for_disabled','is_for_women','is_imported','source','source_url','is_active','status','created_at']);
  job_json:=job_json||jsonb_build_object(
   'regions',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.regions WHERE id=vacancy.region_id),
   'districts',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.districts WHERE id=vacancy.district_id AND (vacancy.region_id IS NULL OR region_id=vacancy.region_id)),
   'categories',(SELECT jsonb_build_object('name_uz',name_uz,'name_ru',name_ru) FROM public.categories WHERE id=vacancy.category_id));
  -- Match only this invitation's resume. Private own active resumes are valid;
  -- missing, transferred, found-job or archived resumes never use a fallback.
  SELECT * INTO cv FROM public.resumes WHERE id=offer.resume_id AND user_id=p_user_id AND status='active' AND found_job IS NOT TRUE FOR SHARE;
  IF FOUND THEN
   SELECT jsonb_object_agg(key,value) INTO resume_json FROM jsonb_each(to_jsonb(cv)) WHERE key=ANY(ARRAY[
    'id','user_id','status','found_job','title','desired_position','field_id','field_title','category_id','category_ids','region_id','district_id',
    'expected_salary_min','expected_salary_max','experience','experience_level','experience_years','education_level','gender','birth_date']);
   resume_json:=resume_json||jsonb_build_object('found_job',false);
  END IF;
 END IF;
 RETURN jsonb_build_object('id',offer.id,'job_id',offer.job_id,'resume_id',CASE WHEN resume_json IS NOT NULL THEN offer.resume_id ELSE NULL END,
  'seeker_user_id',offer.seeker_user_id,'status',offer.status,'message',offer.message,'created_at',offer.created_at,'seen_at',offer.seen_at,
  'job_available',available,'job',job_json,'resume',resume_json);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_seeker_offer(uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_seeker_offer(uuid,integer,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_seeker_offer_seen(p_user_id uuid,p_session_version integer,p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;offer public.job_offers%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_session_version IS NULL OR p_session_version<0 OR p_offer_id IS NULL THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023';END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR SHARE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version<>p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeker unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO offer FROM public.job_offers WHERE id=p_offer_id AND seeker_user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF offer.seen_at IS NULL THEN UPDATE public.job_offers SET seen_at=clock_timestamp() WHERE id=offer.id RETURNING * INTO offer;END IF;
 RETURN jsonb_build_object('id',offer.id,'seeker_user_id',offer.seeker_user_id,'seen_at',offer.seen_at);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_seeker_offer_seen(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_seeker_offer_seen(uuid,integer,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
