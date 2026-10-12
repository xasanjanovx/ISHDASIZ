-- Apply after account_closure and resume_search_state, before BOTH bots.
-- Preserve applications and resume IDs. No physical deletion or bulk backfill.
BEGIN;
ALTER TABLE public.resumes
 ADD COLUMN IF NOT EXISTS desired_position text,
 ADD COLUMN IF NOT EXISTS field_id text,
 ADD COLUMN IF NOT EXISTS field_title text,
 ADD COLUMN IF NOT EXISTS category_ids jsonb DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS special jsonb DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS experience_level text,
 ADD COLUMN IF NOT EXISTS experience_details jsonb DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS education jsonb DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS experience_years integer,
 ADD COLUMN IF NOT EXISTS post_to_channel boolean;
CREATE OR REPLACE FUNCTION public.ishdasiz_resume_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['updated_at','views_count','views']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['updated_at','views_count','views']) THEN
  NEW.updated_at:=GREATEST(clock_timestamp(),COALESCE(OLD.updated_at,'-infinity'::timestamptz)+interval '1 microsecond');
 ELSE NEW.updated_at:=OLD.updated_at;END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_write_own_resume(
 p_user_id uuid,p_session_version integer,p_resume_id uuid,p_action text,
 p_expected_updated_at timestamptz DEFAULT NULL,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;cv public.resumes%ROWTYPE;typed public.resumes%ROWTYPE;
 body jsonb:=p_payload;item record;cols text;changed boolean;existing boolean;
 allowed text[]:=ARRAY['title','desired_position','full_name','about','phone','birth_date','region_id','district_id','category_id','category_ids','field_id','field_title','skills','experience','experience_level','experience_years','education_level','experience_details','education','gender','expected_salary_min','expected_salary_max','special','languages','post_to_channel'];
BEGIN
 IF p_user_id IS NULL OR p_resume_id IS NULL OR p_session_version IS NULL OR p_action IS NULL
  OR p_action NOT IN ('create','edit','archive','restore','publish','hide')
  OR body IS NULL OR jsonb_typeof(body)<>'object' OR octet_length(body::text)>150000 THEN
  RAISE EXCEPTION 'Invalid resume action' USING ERRCODE='22023';END IF;
 FOR item IN SELECT key,value FROM jsonb_each(body) LOOP
  IF NOT item.key=ANY(allowed) THEN RAISE EXCEPTION 'Invalid resume field' USING ERRCODE='22023';END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.resumes'::regclass AND attname=item.key AND attnum>0 AND NOT attisdropped) THEN
   RAISE EXCEPTION 'Resume schema unavailable' USING ERRCODE='42703';END IF;
  IF item.key=ANY(ARRAY['skills','languages','special','category_ids','experience_details','education']) THEN
   IF jsonb_typeof(item.value)<>'array' OR jsonb_array_length(item.value)>100 THEN RAISE EXCEPTION 'Invalid resume list' USING ERRCODE='22023';END IF;
  ELSIF jsonb_typeof(item.value) NOT IN ('null','string','number','boolean') THEN RAISE EXCEPTION 'Invalid resume value' USING ERRCODE='22023';END IF;
  IF jsonb_typeof(item.value)='string' AND length(body->>item.key)>10000 THEN RAISE EXCEPTION 'Resume text too long' USING ERRCODE='22023';END IF;
 END LOOP;
 IF p_action NOT IN ('create','edit') AND body<>'{}'::jsonb THEN RAISE EXCEPTION 'Unexpected resume fields' USING ERRCODE='22023';END IF;
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR account.session_version IS DISTINCT FROM p_session_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seeker unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO cv FROM public.resumes WHERE id=p_resume_id FOR UPDATE;existing:=FOUND;
 IF existing AND cv.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Resume unavailable' USING ERRCODE='42501';END IF;
 IF p_action<>'create' THEN
  IF NOT existing THEN RAISE EXCEPTION 'Resume unavailable' USING ERRCODE='P0002';END IF;
  IF cv.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Resume changed' USING ERRCODE='40001';END IF;
 END IF;
 -- Convert structured language objects for older text[] columns; retain levels.
 IF body?'languages' AND EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.resumes'::regclass AND attname='languages' AND atttypid='text[]'::regtype) THEN
  SELECT jsonb_set(body,'{languages}',COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(value)='object' THEN to_jsonb(value::text) ELSE value END),'[]'::jsonb)) INTO body FROM jsonb_array_elements(body->'languages');
 END IF;
 IF p_action IN ('create','edit') THEN
  IF p_action='edit' AND cv.status='archived' THEN RAISE EXCEPTION 'Restore resume first' USING ERRCODE='40001';END IF;
  SELECT * INTO typed FROM jsonb_populate_record(CASE WHEN existing THEN cv ELSE NULL::public.resumes END,body);
  IF length(COALESCE(typed.title,''))>255 OR length(COALESCE(typed.full_name,''))>255
   OR typed.expected_salary_min<0 OR typed.expected_salary_max<0 OR typed.experience_years<0
   OR typed.expected_salary_min>typed.expected_salary_max THEN RAISE EXCEPTION 'Invalid resume data' USING ERRCODE='22023';END IF;
  IF p_action='create' OR cv.status='active' THEN
   IF NULLIF(btrim(typed.title),'') IS NULL OR NULLIF(btrim(typed.full_name),'') IS NULL OR COALESCE(typed.phone,'') !~ '^\+998[0-9]{9}$' THEN
    RAISE EXCEPTION 'Resume contact required' USING ERRCODE='22023';END IF;
  END IF;
  IF p_action='create' AND existing THEN
   SELECT bool_or(to_jsonb(cv)->key IS DISTINCT FROM to_jsonb(typed)->key) INTO changed FROM jsonb_object_keys(body) key;
   IF changed THEN RAISE EXCEPTION 'Resume creation changed' USING ERRCODE='40001';END IF;
   RETURN jsonb_build_object('id',cv.id,'updated_at',cv.updated_at,'status',cv.status,'is_public',cv.is_public);
  END IF;
  IF p_action='create' THEN
   body:=body||jsonb_build_object('id',p_resume_id,'user_id',p_user_id,'status','active','is_public',true);
   SELECT string_agg(format('%I',key),',' ORDER BY key) INTO cols FROM jsonb_object_keys(body) key;
   EXECUTE format('INSERT INTO public.resumes(%s) SELECT %s FROM jsonb_populate_record(NULL::public.resumes,$1) RETURNING *',cols,cols) INTO cv USING body;
  ELSIF body<>'{}'::jsonb THEN
   SELECT string_agg(format('%I',key),',' ORDER BY key) INTO cols FROM jsonb_object_keys(body) key;
   EXECUTE format('UPDATE public.resumes SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.resumes,$1)) WHERE id=$2 AND user_id=$3 RETURNING *',cols,cols) INTO cv USING body,p_resume_id,p_user_id;
  END IF;
 ELSE
  IF p_action='restore' AND cv.status IS DISTINCT FROM 'archived' OR p_action IN ('publish','hide') AND cv.status='archived' THEN
   RAISE EXCEPTION 'Resume state changed' USING ERRCODE='40001';END IF;
  IF p_action='publish' AND (NULLIF(btrim(cv.title),'') IS NULL OR NULLIF(btrim(cv.full_name),'') IS NULL OR COALESCE(cv.phone,'') !~ '^\+998[0-9]{9}$') THEN
   RAISE EXCEPTION 'Resume contact required' USING ERRCODE='22023';END IF;
  UPDATE public.resumes SET
   status=CASE p_action WHEN 'archive' THEN 'archived' WHEN 'restore' THEN 'draft' WHEN 'publish' THEN 'active' ELSE status END,
   is_public=p_action='publish',
   found_job=CASE WHEN p_action='publish' THEN false ELSE found_job END,
   found_job_at=CASE WHEN p_action='publish' THEN NULL ELSE found_job_at END
   WHERE id=p_resume_id AND user_id=p_user_id RETURNING * INTO cv;
 END IF;
 RETURN jsonb_build_object('id',cv.id,'updated_at',cv.updated_at,'status',cv.status,'is_public',cv.is_public);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_write_own_resume(uuid,integer,uuid,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_write_own_resume(uuid,integer,uuid,text,timestamptz,jsonb) TO service_role;
-- A verified user explicitly choosing the seeker role may create its missing
-- profile. Keep this separate from CV writes so a forged resume action cannot
-- silently switch roles or overwrite an existing account profile.
CREATE OR REPLACE FUNCTION public.ishdasiz_enable_seeker_profile(p_user_id uuid,p_session_version integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account public.users%ROWTYPE;profile_id uuid;
BEGIN
 SELECT * INTO account FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR account.closed_at IS NOT NULL OR p_session_version IS NULL OR account.session_version IS DISTINCT FROM p_session_version THEN
  RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 SELECT id INTO profile_id FROM public.job_seeker_profiles WHERE user_id=p_user_id FOR SHARE;
 IF profile_id IS NULL THEN
  INSERT INTO public.job_seeker_profiles(id,user_id,phone) VALUES(gen_random_uuid(),p_user_id,account.phone) RETURNING id INTO profile_id;
 END IF;
 RETURN profile_id;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_enable_seeker_profile(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_enable_seeker_profile(uuid,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
