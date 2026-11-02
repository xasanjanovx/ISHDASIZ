-- Mini App storage and budgets. Apply after the audited October release and
-- 20261027090000_main_employer_channel.sql. Does not seed or send any posts.
BEGIN;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS mini_app_channel_requested boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hr_name text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS mini_app_salary_period text CHECK(mini_app_salary_period IN('month','shift','hour','service'));
CREATE INDEX IF NOT EXISTS mini_app_jobs_salary_period ON public.jobs(mini_app_salary_period) WHERE mini_app_salary_period IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.mini_app_records (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id), kind text NOT NULL CHECK(kind IN('vacancy','resume')),
 payload jsonb NOT NULL, metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS mini_app_records_owner ON public.mini_app_records(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.mini_app_ai_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity_hash text NOT NULL CHECK(length(identity_hash)=64),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS mini_app_ai_usage_time ON public.mini_app_ai_usage(created_at,identity_hash);
CREATE TABLE IF NOT EXISTS public.mini_app_analysis (
 cache_key text PRIMARY KEY CHECK(length(cache_key)=64), result jsonb NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.mini_app_resume_views (
 viewer_id uuid NOT NULL REFERENCES public.users(id),resume_id uuid NOT NULL REFERENCES public.resumes(id),
 viewed_day date NOT NULL DEFAULT (timezone('Asia/Tashkent',clock_timestamp())::date),PRIMARY KEY(viewer_id,resume_id,viewed_day)
);
CREATE TABLE IF NOT EXISTS public.mini_app_channel_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id),
 job_id uuid NOT NULL REFERENCES public.jobs(id), metadata jsonb NOT NULL, metadata_hash text NOT NULL,
 free boolean NOT NULL DEFAULT false, status text NOT NULL CHECK(status IN('queued','confirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(job_id,metadata_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS mini_app_one_free_channel ON public.mini_app_channel_orders(user_id) WHERE free;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['mini_app_records','mini_app_ai_usage','mini_app_analysis','mini_app_channel_orders','mini_app_resume_views'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_budget(p_identity text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_identity IS NULL OR p_identity!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid identity' USING ERRCODE='22023';END IF;
 -- All instances share a global ceiling, including requests with reset cookies/IPs.
 PERFORM pg_advisory_xact_lock(hashtext('ishdasiz-mini-ai-daily'));
 IF (SELECT count(*) FROM mini_app_ai_usage WHERE created_at>clock_timestamp()-interval '24 hours')>=100
  OR (SELECT count(*) FROM mini_app_ai_usage WHERE identity_hash=p_identity AND created_at>clock_timestamp()-interval '24 hours')>=8
  OR (SELECT count(*) FROM mini_app_ai_usage WHERE identity_hash=p_identity AND created_at>clock_timestamp()-interval '1 minute')>=2 THEN RETURN false;END IF;
 INSERT INTO mini_app_ai_usage(identity_hash) VALUES(p_identity);
 DELETE FROM mini_app_ai_usage WHERE created_at<clock_timestamp()-interval '2 days';
 DELETE FROM mini_app_analysis WHERE expires_at<clock_timestamp()-interval '2 days';
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_save(p_user uuid,p_version integer,p_id uuid,p_kind text,p_payload jsonb,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users%ROWTYPE; old public.mini_app_records%ROWTYPE; data jsonb; tbl text; cols text; vals text; employer uuid; allowed text[];
BEGIN
 SELECT * INTO u FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND OR u.closed_at IS NOT NULL OR p_version IS NULL OR u.session_version<>p_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN('vacancy','resume') OR jsonb_typeof(p_payload)<>'object' OR jsonb_typeof(p_metadata)<>'object'
  OR p_payload IS NULL OR p_metadata IS NULL OR octet_length(p_payload::text)>100000 OR octet_length(p_metadata::text)>50000 THEN RAISE EXCEPTION 'Invalid data' USING ERRCODE='22023';END IF;
 SELECT * INTO old FROM mini_app_records WHERE id=p_id;
 IF FOUND THEN
  IF old.user_id<>p_user OR old.kind<>p_kind OR old.payload<>p_payload OR old.metadata<>p_metadata THEN RAISE EXCEPTION 'Save conflict' USING ERRCODE='23505';END IF;
  RETURN jsonb_build_object('id',old.id,'kind',old.kind);
 END IF;
 IF p_kind='vacancy' THEN
  SELECT id INTO employer FROM employer_profiles WHERE user_id=p_user;
  IF employer IS NULL THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501';END IF;
  tbl:='jobs';allowed:=ARRAY['title_uz','title_ru','description_uz','description_ru','company_name','category_id','region_id','district_id','salary_min','salary_max','employment_type','latitude','longitude','address','contact_phone','contact_telegram','requirements_uz','requirements_ru','benefits','experience','education_level','gender','age_min','age_max','languages','skills','is_for_students','is_for_disabled','is_for_women','payment_type','work_mode','hr_name'];
  data:=p_payload||jsonb_build_object('id',p_id,'employer_id',employer,'user_id',p_user,'created_by',p_user,'source','mini_app','status','active','is_active',true,'mini_app_channel_requested',false,'mini_app_salary_period',p_metadata->>'salaryPeriod');
 ELSE
  tbl:='resumes';allowed:=ARRAY['title','full_name','birth_date','phone','city','about','category_id','region_id','district_id','experience','experience_years','experience_details','education_level','education','languages','skills','employment_type','gender','expected_salary_min','expected_salary_max','status','is_public'];
  data:=p_payload||jsonb_build_object('id',p_id,'user_id',p_user,'status','active','is_public',true,'post_to_channel',false);
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'Unknown field' USING ERRCODE='22023';END IF;
 SELECT string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(NULL::public.%I,$1)).%I',tbl,key),',') INTO cols,vals FROM jsonb_object_keys(data) key;
 EXECUTE format('INSERT INTO public.%I(%s) SELECT %s',tbl,cols,vals) USING data;
 INSERT INTO mini_app_records(id,user_id,kind,payload,metadata) VALUES(p_id,p_user,p_kind,p_payload,p_metadata);
 RETURN jsonb_build_object('id',p_id,'kind',p_kind);
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_channel(p_user uuid,p_version integer,p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users%ROWTYPE; r public.mini_app_records%ROWTYPE; o public.mini_app_channel_orders%ROWTYPE; used boolean;
BEGIN
 SELECT * INTO u FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND OR u.closed_at IS NOT NULL OR u.session_version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM mini_app_records WHERE id=p_job AND user_id=p_user AND kind='vacancy' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jobs j WHERE j.id=p_job AND public.ishdasiz_job_available(j) AND (EXISTS(SELECT 1 FROM employer_profiles e WHERE e.id=j.employer_id AND e.user_id=p_user) OR j.employer_id IS NULL AND (j.user_id=p_user OR j.user_id IS NULL AND j.created_by=p_user))) THEN RAISE EXCEPTION 'Vacancy unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM mini_app_channel_orders WHERE job_id=p_job AND metadata=r.metadata AND status IN('queued','confirmed');
 IF FOUND THEN RETURN jsonb_build_object('status',o.status,'id',o.id);END IF;
 SELECT EXISTS(SELECT 1 FROM mini_app_channel_orders WHERE user_id=p_user AND free)
  OR EXISTS(SELECT 1 FROM channel_delivery_receipts receipt JOIN jobs j ON j.id=receipt.entity_id LEFT JOIN employer_profiles ep ON ep.id=j.employer_id
   WHERE receipt.entity_type='job' AND receipt.channel_username='@ishdasiz' AND receipt.message_id>0 AND (ep.user_id=p_user OR j.employer_id IS NULL AND (j.user_id=p_user OR j.user_id IS NULL AND j.created_by=p_user))) INTO used;
 IF used THEN RETURN jsonb_build_object('status','payment_required');END IF;
 INSERT INTO mini_app_channel_orders(user_id,job_id,metadata,metadata_hash,free,status) VALUES(p_user,p_job,r.metadata,md5(r.metadata::text),true,'queued') RETURNING * INTO o;
 UPDATE jobs SET mini_app_channel_requested=true WHERE id=p_job;
 INSERT INTO sync_events(entity_type,entity_id,action,payload,status,next_retry_at) VALUES('job',p_job,'upsert','{"mini_app":true}'::jsonb,'pending',clock_timestamp()) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('status','queued','id',o.id);
END $$;

-- Website saving must never send a channel post before an explicit request.
CREATE OR REPLACE FUNCTION public.ishdasiz_channel_target(p_snapshot jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_snapshot->>'available'='true' THEN CASE
 WHEN p_snapshot->'entity'->>'source'='mini_app' THEN CASE WHEN p_snapshot->'entity'->>'mini_app_channel_requested'='true' THEN '@ishdasiz' END
 WHEN p_snapshot->'entity'->>'source'='local' THEN '@ishdasiz' ELSE CASE p_snapshot->>'region_slug'
 WHEN 'toshkent-shahri' THEN '@ishdasiz_toshkent' WHEN 'toshkent-shahar' THEN '@ishdasiz_toshkent'
 WHEN 'toshkent-viloyati' THEN '@ishdasiz_toshkent_vil' WHEN 'samarqand-viloyati' THEN '@ishdasiz_samarqand'
 WHEN 'navoiy-viloyati' THEN '@ishdasiz_navoiy' WHEN 'qoraqalpogiston-respublikasi' THEN '@ishdasiz_qoraqalpogiston'
 WHEN 'qashqadaryo-viloyati' THEN '@ishdasiz_qashqadaryo' WHEN 'surxondaryo-viloyati' THEN '@ishdasiz_surxondaryo'
 WHEN 'fargona-viloyati' THEN '@ishdasiz_fargona' WHEN 'namangan-viloyati' THEN '@ishdasiz_namangan'
 WHEN 'sirdaryo-viloyati' THEN '@ishdasiz_sirdaryo' WHEN 'jizzax-viloyati' THEN '@ishdasiz_jizzax'
 WHEN 'buxoro-viloyati' THEN '@ishdasiz_buxoro' WHEN 'xorazm-viloyati' THEN '@ishdasiz_xorazm'
 WHEN 'andijon-viloyati' THEN '@ishdasiz_andijon' END END END
$$;
-- A queued request or a client flag never opens candidate data. Record proof
-- only after the delivery worker confirms Telegram's actual message ID.
CREATE TABLE IF NOT EXISTS public.mini_app_channel_confirmations (
 job_id uuid PRIMARY KEY REFERENCES public.jobs(id), receipt_id uuid NOT NULL REFERENCES public.channel_delivery_receipts(id),
 criteria_hash text NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.mini_app_channel_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mini_app_channel_confirmations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.mini_app_channel_confirmations TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_criteria(p_job uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT md5(jsonb_build_object('title',j.title_uz,'title_ru',j.title_ru,'category',j.category_id,'region',j.region_id,'district',j.district_id,
  'salary_min',j.salary_min,'salary_max',j.salary_max,'employment',j.employment_type,'experience',j.experience,'work_mode',j.work_mode,'education',j.education_level,'languages',j.languages,'skills',j.skills,
  'latitude',j.latitude,'longitude',j.longitude,'metadata',r.metadata)::text)
 FROM jobs j JOIN mini_app_records r ON r.id=j.id AND r.kind='vacancy' WHERE j.id=p_job
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_confirm_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE receipt public.channel_delivery_receipts%ROWTYPE; jid uuid; snapshot jsonb;
BEGIN
 IF TG_TABLE_NAME='channel_delivery_intents' THEN
  IF NEW.entity_type<>'job' OR NEW.channel_username<>'@ishdasiz' OR NEW.status<>'confirmed' OR NEW.message_id IS NULL THEN RETURN NEW;END IF;
  SELECT * INTO receipt FROM channel_delivery_receipts WHERE entity_type='job' AND entity_id=NEW.entity_id AND channel_username='@ishdasiz' AND message_id=NEW.message_id AND status='active';
  IF NOT FOUND THEN RETURN NEW;END IF;
  snapshot:=ishdasiz_channel_snapshot('job',NEW.entity_id);
  IF md5(snapshot::text) IS DISTINCT FROM NEW.snapshot_hash OR ishdasiz_channel_target(snapshot) IS DISTINCT FROM '@ishdasiz' THEN RETURN NEW;END IF;
  jid:=NEW.entity_id;
 ELSE
  IF NEW.entity_type<>'job' OR NEW.channel_username<>'@ishdasiz' THEN RETURN NEW;END IF;
  IF NEW.status<>'active' THEN DELETE FROM mini_app_channel_confirmations WHERE receipt_id=NEW.id;RETURN NEW;END IF;
  IF NEW.message_hash IS NOT DISTINCT FROM OLD.message_hash THEN RETURN NEW;END IF;
  receipt:=NEW;jid:=NEW.entity_id;
 END IF;
 IF ishdasiz_mini_app_criteria(jid) IS NOT NULL THEN
  INSERT INTO mini_app_channel_confirmations(job_id,receipt_id,criteria_hash) VALUES(jid,receipt.id,ishdasiz_mini_app_criteria(jid))
  ON CONFLICT(job_id) DO UPDATE SET receipt_id=EXCLUDED.receipt_id,criteria_hash=EXCLUDED.criteria_hash,confirmed_at=clock_timestamp();
  UPDATE mini_app_channel_orders SET status='confirmed' WHERE job_id=jid AND status='queued';
 END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mini_app_delivery_confirmed ON public.channel_delivery_intents;
CREATE TRIGGER mini_app_delivery_confirmed AFTER UPDATE OF status,message_id ON public.channel_delivery_intents FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_mini_app_confirm_delivery();
DROP TRIGGER IF EXISTS mini_app_delivery_edited ON public.channel_delivery_receipts;
CREATE TRIGGER mini_app_delivery_edited AFTER UPDATE OF message_hash,status ON public.channel_delivery_receipts FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_mini_app_confirm_delivery();
CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_candidate_access(p_user uuid,p_version integer,p_job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN mini_app_records r ON r.user_id=u.id AND r.kind='vacancy'
 JOIN jobs j ON j.id=r.id JOIN mini_app_channel_confirmations c ON c.job_id=j.id
 JOIN channel_delivery_receipts d ON d.id=c.receipt_id
 WHERE u.id=p_user AND u.closed_at IS NULL AND u.session_version=p_version AND j.id=p_job AND ishdasiz_job_available(j)
 AND d.status='active' AND d.channel_username='@ishdasiz' AND d.entity_type='job' AND d.entity_id=j.id AND d.message_id>0
 AND (EXISTS(SELECT 1 FROM employer_profiles e WHERE e.id=j.employer_id AND e.user_id=p_user) OR j.employer_id IS NULL AND (j.user_id=p_user OR j.user_id IS NULL AND j.created_by=p_user))
 AND c.criteria_hash=ishdasiz_mini_app_criteria(j.id))
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_mini_app_criteria(uuid),public.ishdasiz_mini_app_confirm_delivery(),public.ishdasiz_mini_app_candidate_access(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_mini_app_candidate_access(uuid,integer,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.ishdasiz_mini_app_resume_view(p_user uuid,p_version integer,p_job uuid,p_resume uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inserted integer;field text;
BEGIN
 IF NOT ishdasiz_mini_app_candidate_access(p_user,p_version,p_job)
  OR NOT EXISTS(SELECT 1 FROM resumes r WHERE r.id=p_resume AND r.ishdasiz_resume_available AND r.user_id<>p_user) THEN RETURN false;END IF;
 INSERT INTO mini_app_resume_views(viewer_id,resume_id) VALUES(p_user,p_resume) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted>0 THEN
  SELECT column_name INTO field FROM information_schema.columns WHERE table_schema='public' AND table_name='resumes' AND column_name IN('views','views_count') ORDER BY CASE WHEN column_name='views' THEN 0 ELSE 1 END LIMIT 1;
  IF field IS NOT NULL THEN EXECUTE format('UPDATE public.resumes SET %1$I=COALESCE(%1$I,0)+1 WHERE id=$1',field) USING p_resume;END IF;
 END IF;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_mini_app_resume_view(uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_mini_app_resume_view(uuid,integer,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.ishdasiz_mini_app_budget(text),public.ishdasiz_mini_app_save(uuid,integer,uuid,text,jsonb,jsonb),public.ishdasiz_mini_app_channel(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_mini_app_budget(text),public.ishdasiz_mini_app_save(uuid,integer,uuid,text,jsonb,jsonb),public.ishdasiz_mini_app_channel(uuid,integer,uuid) TO service_role;
COMMIT;
