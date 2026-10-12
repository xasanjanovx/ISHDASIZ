-- Requires account_closure, public_job_availability and job_auto_matches_v2.
BEGIN;
ALTER TABLE public.job_auto_matches ADD COLUMN IF NOT EXISTS notification_state text NOT NULL DEFAULT 'pending',
 ADD COLUMN IF NOT EXISTS notification_token uuid, ADD COLUMN IF NOT EXISTS notification_attempted_at timestamptz,
 ADD COLUMN IF NOT EXISTS notification_message_id bigint, ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.job_auto_matches DROP CONSTRAINT IF EXISTS job_auto_matches_notification_state_check;
ALTER TABLE public.job_auto_matches ADD CONSTRAINT job_auto_matches_notification_state_check CHECK(notification_state IN('pending','sending','sent','uncertain','rejected'));
UPDATE public.job_auto_matches SET notification_state='sent' WHERE notified IS TRUE AND notification_state='pending';
ALTER TABLE public.job_auto_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_auto_matches FROM PUBLIC,anon,authenticated;
DO $$ DECLARE col text; BEGIN
 FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='job_auto_matches' LOOP
  EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.job_auto_matches FROM PUBLIC,anon,authenticated',col,col,col,col);
 END LOOP;
END $$;
GRANT ALL ON public.job_auto_matches TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_auto_match_store(p_user uuid,p_epoch integer,p_job uuid,p_resume uuid,p_recipient uuid,p_score integer,p_criteria jsonb,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j jobs%ROWTYPE;r resumes%ROWTYPE;m job_auto_matches%ROWTYPE;chat bigint;lang text;claimed boolean:=false;
BEGIN
 IF p_user IS NULL OR p_epoch IS NULL OR p_epoch<0 OR p_job IS NULL OR p_resume IS NULL OR p_recipient IS NULL OR p_user=p_recipient
  OR p_token IS NULL OR p_score IS NULL OR p_score<0 OR p_score>100 OR p_criteria IS NULL OR jsonb_typeof(p_criteria)<>'object' OR octet_length(p_criteria::text)>16000 THEN
  RAISE EXCEPTION 'Invalid recommendation' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM users WHERE id IN(p_user,p_recipient) ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND closed_at IS NULL AND session_version=p_epoch)
  OR NOT EXISTS(SELECT 1 FROM users WHERE id=p_recipient AND closed_at IS NULL)
  OR NOT EXISTS(SELECT 1 FROM employer_profiles WHERE user_id=p_user) THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM jobs WHERE id=p_job FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vacancy unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM employer_profiles WHERE id=j.employer_id FOR SHARE;
 IF NOT ishdasiz_job_available(j) OR ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by) IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Vacancy unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM resumes WHERE id=p_resume FOR SHARE;
 IF NOT FOUND OR r.user_id IS DISTINCT FROM p_recipient OR r.status IS DISTINCT FROM 'active' OR r.is_public IS NOT TRUE OR r.found_job IS NOT FALSE THEN
  RAISE EXCEPTION 'Candidate unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO job_auto_matches(job_id,resume_id,user_id,match_score,match_criteria)
  VALUES(p_job,p_resume,p_recipient,p_score,p_criteria)
  ON CONFLICT(job_id,resume_id) DO UPDATE SET match_score=EXCLUDED.match_score,match_criteria=EXCLUDED.match_criteria
   WHERE job_auto_matches.user_id=EXCLUDED.user_id RETURNING * INTO m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recommendation recipient changed' USING ERRCODE='42501';END IF;
 SELECT nullif(to_jsonb(u)->>'telegram_user_id','')::bigint INTO chat FROM users u WHERE id=p_recipient;
 SELECT to_jsonb(t)->>'lang' INTO lang FROM telegram_sessions t WHERE t.user_id=p_recipient ORDER BY to_jsonb(t)->>'updated_at' DESC NULLS LAST LIMIT 1;
 IF chat BETWEEN 1 AND 9007199254740991 AND m.seeker_response IS NULL AND m.notified IS NOT TRUE AND m.notification_state IN('pending','rejected') THEN
  UPDATE job_auto_matches SET notification_state='sending',notification_token=p_token,notification_attempted_at=clock_timestamp(),telegram_user_id=chat WHERE id=m.id;
  claimed:=true;
 END IF;
 RETURN jsonb_build_object('id',m.id,'job_id',p_job,'resume_id',p_resume,'user_id',p_recipient,'match_score',p_score,
  'notification_token',CASE WHEN claimed THEN p_token ELSE null END,'telegram_user_id',CASE WHEN claimed THEN chat ELSE null END,
  'lang',CASE WHEN lang='ru' THEN 'ru' ELSE 'uz' END,
  'job',jsonb_build_object('id',j.id,'title_ru',to_jsonb(j)->>'title_ru','title_uz',to_jsonb(j)->>'title_uz','title',to_jsonb(j)->>'title','company_name',to_jsonb(j)->>'company_name'));
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_auto_match_delivery(p_match uuid,p_token uuid,p_outcome text,p_message bigint DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m job_auto_matches%ROWTYPE;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN('sent','uncertain','rejected') OR p_outcome='sent' AND (p_message IS NULL OR p_message<1 OR p_message>9007199254740991)
  OR p_outcome<>'sent' AND p_message IS NOT NULL THEN RAISE EXCEPTION 'Invalid recommendation delivery' USING ERRCODE='22023';END IF;
 SELECT * INTO m FROM job_auto_matches WHERE id=p_match AND notification_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF m.notification_state='sent' THEN RETURN p_outcome='sent' AND m.notification_message_id=p_message;END IF;
 IF m.notification_state NOT IN('sending','uncertain','rejected') THEN RETURN false;END IF;
 UPDATE job_auto_matches SET notification_state=p_outcome,
  notification_message_id=CASE WHEN p_outcome='sent' THEN p_message ELSE notification_message_id END,
  notified=CASE WHEN p_outcome='sent' THEN true ELSE notified END,
  notified_at=CASE WHEN p_outcome='sent' THEN clock_timestamp() ELSE notified_at END WHERE id=m.id;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_auto_match_action(p_user uuid,p_epoch integer,p_match uuid,p_action text,p_job uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m job_auto_matches%ROWTYPE;j jobs%ROWTYPE;
BEGIN
 IF p_user IS NULL OR p_epoch IS NULL OR p_epoch<0 OR p_match IS NULL OR p_action IS NULL OR p_action NOT IN('view','interested','skip') THEN
  RAISE EXCEPTION 'Invalid recommendation action' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM users WHERE id=p_user AND closed_at IS NULL AND session_version=p_epoch FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM job_seeker_profiles WHERE user_id=p_user) THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO m FROM job_auto_matches WHERE id=p_match AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR p_job IS NOT NULL AND m.job_id IS DISTINCT FROM p_job THEN RAISE EXCEPTION 'Recommendation unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM resumes WHERE id=m.resume_id AND user_id=p_user FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recommendation recipient changed' USING ERRCODE='42501';END IF;
 IF p_action<>'skip' THEN
  SELECT * INTO j FROM jobs WHERE id=m.job_id FOR SHARE;
  IF NOT FOUND OR NOT ishdasiz_job_available(j) THEN RAISE EXCEPTION 'Vacancy unavailable' USING ERRCODE='42501';END IF;
 END IF;
 IF p_action='interested' AND NOT EXISTS(SELECT 1 FROM job_applications a JOIN resumes r ON r.id=a.resume_id AND r.user_id=p_user
  WHERE a.job_id=m.job_id AND a.user_id=p_user) THEN RAISE EXCEPTION 'Application must be saved first' USING ERRCODE='40001';END IF;
 IF p_action<>'view' THEN
  UPDATE job_auto_matches SET seeker_response=CASE WHEN p_action='skip' THEN 'not_interested' ELSE 'interested' END,
   responded_at=CASE WHEN seeker_response IS DISTINCT FROM CASE WHEN p_action='skip' THEN 'not_interested' ELSE 'interested' END THEN clock_timestamp() ELSE responded_at END
   WHERE id=m.id RETURNING * INTO m;
 END IF;
 RETURN jsonb_build_object('id',m.id,'job_id',m.job_id,'resume_id',m.resume_id,'user_id',m.user_id,'seeker_response',m.seeker_response,
  'job',CASE WHEN p_action='skip' THEN null ELSE to_jsonb(j) END);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_auto_match_store(uuid,integer,uuid,uuid,uuid,integer,jsonb,uuid),public.ishdasiz_auto_match_delivery(uuid,uuid,text,bigint),public.ishdasiz_auto_match_action(uuid,integer,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_auto_match_store(uuid,integer,uuid,uuid,uuid,integer,jsonb,uuid),public.ishdasiz_auto_match_delivery(uuid,uuid,text,bigint),public.ishdasiz_auto_match_action(uuid,integer,uuid,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_auto_match_resolve(p_match uuid,p_expected_attempted timestamptz,p_message bigint,p_not_delivered boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m job_auto_matches%ROWTYPE;
BEGIN
 SELECT * INTO m FROM job_auto_matches WHERE id=p_match FOR UPDATE;
 IF NOT FOUND OR m.notification_state NOT IN('sending','uncertain') OR m.notification_attempted_at IS DISTINCT FROM p_expected_attempted THEN RETURN false;END IF;
 IF m.notification_attempted_at IS NULL OR m.notification_attempted_at>clock_timestamp()-interval '5 minutes' THEN RAISE EXCEPTION 'Recommendation delivery is in flight' USING ERRCODE='55000';END IF;
 IF p_not_delivered IS TRUE AND p_message IS NULL THEN RETURN ishdasiz_auto_match_delivery(m.id,m.notification_token,'rejected',null);
 ELSIF p_not_delivered IS FALSE AND p_message IS NOT NULL THEN RETURN ishdasiz_auto_match_delivery(m.id,m.notification_token,'sent',p_message);
 ELSE RAISE EXCEPTION 'Invalid recommendation resolution' USING ERRCODE='22023';END IF;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_auto_match_resolve(uuid,timestamptz,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_auto_match_resolve(uuid,timestamptz,bigint,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
