-- Install with the channel worker and both bots, after account_closure,
-- public_job_availability, resume_search_state and channel_autopost_outbox.
BEGIN;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS post_to_channel boolean;
ALTER TABLE public.channel_posts DROP CONSTRAINT IF EXISTS channel_posts_status_check;
ALTER TABLE public.channel_posts ADD CONSTRAINT channel_posts_status_check CHECK(status IN('active','deleted','redacted'));
DO $$ DECLARE tbl text; col text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['sync_events','channel_posts','sync_worker_locks'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.%I FROM PUBLIC,anon,authenticated',col,col,col,col,tbl);
  END LOOP;
  EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',tbl);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.acquire_worker_lock(text,integer), public.release_worker_lock(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_worker_lock(text,integer), public.release_worker_lock(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_resume_channel_available(r public.resumes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT r.is_public IS TRUE AND r.status='active' AND r.found_job IS FALSE
  AND r.post_to_channel IS TRUE AND r.user_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=r.user_id AND u.closed_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.ishdasiz_resume_channel_available(public.resumes) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_resume_channel_available(public.resumes) TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_snapshot(p_type text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE document jsonb; v_slug text; region jsonb; district jsonb;
BEGIN
 IF p_type IS NULL OR p_type NOT IN('job','resume') OR p_id IS NULL THEN RAISE EXCEPTION 'Invalid channel entity' USING ERRCODE='22023';END IF;
 IF p_type='job' THEN
  SELECT to_jsonb(j)||jsonb_build_object('channel_account_open',true) INTO document FROM public.jobs j
   WHERE j.id=p_id AND public.ishdasiz_job_available(j);
 ELSE
  SELECT to_jsonb(r)||jsonb_build_object('channel_account_open',true) INTO document FROM public.resumes r
   WHERE r.id=p_id AND public.ishdasiz_resume_channel_available(r);
  SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) INTO document FROM jsonb_each(document)
   WHERE key=ANY(ARRAY['id','title','desired_position','field_title','full_name','about','skills','languages',
    'expected_salary_min','expected_salary_max','experience','experience_level','experience_years','education_level',
    'status','is_public','post_to_channel','found_job','region_id','district_id','phone','telegram','gender','birth_date',
    'special','channel_account_open']);
  IF document='{}'::jsonb THEN document:=null;END IF;
 END IF;
 IF document IS NULL THEN RETURN jsonb_build_object('available',false,'entity',null,'region_slug',null);END IF;
 -- Canonical vacancy/CV region takes priority over a mismatched district or old event.
 IF (document->>'region_id') IS NOT NULL THEN
  SELECT reg.slug INTO v_slug FROM public.regions reg WHERE reg.id=(document->>'region_id')::bigint;
 ELSE
  SELECT reg.slug INTO v_slug FROM public.districts d JOIN public.regions reg ON reg.id=d.region_id
   WHERE d.id=(document->>'district_id')::bigint;
 END IF;
 SELECT to_jsonb(reg) INTO region FROM public.regions reg WHERE reg.slug=v_slug;
 SELECT to_jsonb(d) INTO district FROM public.districts d WHERE d.id=(document->>'district_id')::bigint
  AND (region IS NULL OR d.region_id=(region->>'id')::bigint);
 document:=document||jsonb_build_object('region_name',COALESCE(region->>'name_uz',region->>'name_ru'),
  'district_name',COALESCE(district->>'name_uz',district->>'name_ru'),
  'districts',COALESCE(district,'{}'::jsonb)||jsonb_build_object('regions',region));
 RETURN jsonb_build_object('available',true,'entity',document,'region_slug',v_slug);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_channel_snapshot(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_channel_snapshot(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_job_sync_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE doc jsonb; action text;
BEGIN
 IF TG_OP='UPDATE' AND
  (to_jsonb(NEW)-ARRAY['updated_at','views','views_count','last_seen_at','last_synced_at','last_checked_at'])
  IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','views','views_count','last_seen_at','last_synced_at','last_checked_at']) THEN RETURN NEW;END IF;
 IF TG_OP='DELETE' THEN doc:=to_jsonb(OLD);action:='delete';
 ELSE doc:=to_jsonb(NEW);action:=CASE WHEN public.ishdasiz_job_available(NEW) THEN 'upsert' ELSE 'deactivate' END;END IF;
 INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
  VALUES('job',(doc->>'id')::uuid,action,(doc->>'region_id')::bigint,'{}'::jsonb,'pending',clock_timestamp());
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE OR REPLACE FUNCTION public.enqueue_resume_sync_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE doc jsonb; action text;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['updated_at','views','views_count'])
  IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','views','views_count']) THEN RETURN NEW;END IF;
 IF TG_OP='DELETE' THEN doc:=to_jsonb(OLD);action:='delete';
 ELSE doc:=to_jsonb(NEW);action:=CASE WHEN public.ishdasiz_resume_channel_available(NEW) THEN 'upsert' ELSE 'deactivate' END;END IF;
 INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
  VALUES('resume',(doc->>'id')::uuid,action,(doc->>'region_id')::bigint,'{}'::jsonb,'pending',clock_timestamp());
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS trg_sync_jobs_events ON public.jobs;
CREATE TRIGGER trg_sync_jobs_events AFTER INSERT OR UPDATE OR DELETE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.enqueue_job_sync_event();
DROP TRIGGER IF EXISTS trg_sync_resumes_events ON public.resumes;
CREATE TRIGGER trg_sync_resumes_events AFTER INSERT OR UPDATE OR DELETE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.enqueue_resume_sync_event();
REVOKE ALL ON FUNCTION public.enqueue_job_sync_event(),public.enqueue_resume_sync_event() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_account_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.closed_at IS NOT DISTINCT FROM OLD.closed_at THEN RETURN NEW;END IF;
 INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
  SELECT 'job',j.id,CASE WHEN public.ishdasiz_job_available(j) THEN 'upsert' ELSE 'deactivate' END,j.region_id,'{}'::jsonb,'pending',clock_timestamp()
   FROM public.jobs j WHERE public.ishdasiz_job_owner(j.employer_id,j.user_id,j.created_by)=NEW.id;
 INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
  SELECT 'resume',r.id,CASE WHEN public.ishdasiz_resume_channel_available(r) THEN 'upsert' ELSE 'deactivate' END,r.region_id,'{}'::jsonb,'pending',clock_timestamp()
   FROM public.resumes r WHERE r.user_id=NEW.id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ishdasiz_channel_account_change ON public.users;
CREATE TRIGGER ishdasiz_channel_account_change AFTER UPDATE OF closed_at ON public.users FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_channel_account_change();
REVOKE ALL ON FUNCTION public.ishdasiz_channel_account_change() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ishdasiz_channel_employer_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.sync_events(entity_type,entity_id,action,region_id,payload,status,next_retry_at)
  SELECT 'job',j.id,'upsert',j.region_id,'{}'::jsonb,'pending',clock_timestamp()
   FROM public.jobs j WHERE j.employer_id=OLD.id;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS ishdasiz_channel_employer_change ON public.employer_profiles;
CREATE TRIGGER ishdasiz_channel_employer_change AFTER UPDATE OF user_id OR DELETE ON public.employer_profiles
 FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_channel_employer_change();
REVOKE ALL ON FUNCTION public.ishdasiz_channel_employer_change() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ishdasiz_seed_channel_sync(p_type text DEFAULT 'all',p_limit integer DEFAULT 200,p_after_type text DEFAULT NULL,p_after_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record; scanned integer:=0; jobs integer:=0; resumes integer:=0; added integer; last_type text; last_id uuid;
BEGIN
 IF p_type IS NULL OR p_type NOT IN('all','job','resume') OR p_limit IS NULL OR p_limit<1 OR p_limit>5000
  OR (p_after_type IS NULL)<>(p_after_id IS NULL) OR p_after_type NOT IN('job','resume') THEN
  RAISE EXCEPTION 'Invalid channel seed' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(1769174123);
 -- Include old posts even if their entity was deleted, hidden, moved or opted out.
 FOR item IN SELECT entity_type,entity_id FROM (
  SELECT 'job'::text entity_type,j.id entity_id FROM public.jobs j WHERE public.ishdasiz_job_available(j)
  UNION SELECT 'resume',r.id FROM public.resumes r WHERE public.ishdasiz_resume_channel_available(r)
  UNION SELECT c.entity_type,c.entity_id FROM public.channel_posts c WHERE c.status='active'
 ) eligible WHERE (p_type='all' OR entity_type=p_type)
  AND (p_after_type IS NULL OR (entity_type,entity_id)>(p_after_type,p_after_id))
 ORDER BY entity_type,entity_id LIMIT p_limit LOOP
  scanned:=scanned+1;last_type:=item.entity_type;last_id:=item.entity_id;
  INSERT INTO public.sync_events(entity_type,entity_id,action,payload,status,next_retry_at)
   SELECT item.entity_type,item.entity_id,'upsert','{"reconcile":true}'::jsonb,'pending',clock_timestamp()
   WHERE NOT EXISTS(SELECT 1 FROM public.sync_events e WHERE e.entity_type=item.entity_type AND e.entity_id=item.entity_id AND e.status IN('pending','processing','failed'));
  GET DIAGNOSTICS added=ROW_COUNT;
  IF item.entity_type='job' THEN jobs:=jobs+added;ELSE resumes:=resumes+added;END IF;
 END LOOP;
 RETURN jsonb_build_object('scanned',scanned,'jobs',jobs,'resumes',resumes,'after_type',last_type,'after_id',last_id,'has_more',scanned=p_limit);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_seed_channel_sync(text,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_seed_channel_sync(text,integer,text,uuid) TO service_role;
-- Queue reconciliation of known posts without publishing any new entities here.
INSERT INTO public.sync_events(entity_type,entity_id,action,payload,status,next_retry_at)
 SELECT DISTINCT c.entity_type,c.entity_id,'upsert','{"reconcile":true}'::jsonb,'pending',clock_timestamp()
 FROM public.channel_posts c WHERE c.status='active'
  AND NOT EXISTS(SELECT 1 FROM public.sync_events e WHERE e.entity_type=c.entity_type AND e.entity_id=c.entity_id AND e.status IN('pending','processing','failed'));
NOTIFY pgrst,'reload schema';
COMMIT;
