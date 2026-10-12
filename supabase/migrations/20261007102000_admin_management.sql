-- Install after admin_access, with the new administration API and retired
-- create-admin Edge Function. No authentication accounts or profiles are deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_creation_requests (
 request_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES public.admin_profiles(id),
 target_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 profile jsonb NOT NULL,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','completed')),
 lease_id uuid,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.admin_profile_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES public.admin_profiles(id),
 target_id uuid NOT NULL REFERENCES public.admin_profiles(id),
 action text NOT NULL CHECK(action IN ('create','edit','disable','enable')),
 previous_access jsonb,
 resulting_access jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS admin_profile_actions_target_date ON public.admin_profile_actions(target_id,created_at DESC);
DO $$ DECLARE tbl text;col text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['admin_creation_requests','admin_profile_actions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',tbl);
  FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl LOOP
   EXECUTE format('REVOKE ALL(%I) ON public.%I FROM PUBLIC,anon,authenticated,service_role',col,tbl);
  END LOOP;
 END LOOP;
END $$;
GRANT SELECT ON public.admin_creation_requests,public.admin_profile_actions TO service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_internal_super_admin(p_actor_id uuid,p_write boolean DEFAULT true)
RETURNS public.admin_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.admin_profiles%ROWTYPE;
BEGIN
 IF p_write THEN SELECT * INTO actor FROM public.admin_profiles WHERE id=p_actor_id FOR UPDATE;
 ELSE SELECT * INTO actor FROM public.admin_profiles WHERE id=p_actor_id FOR SHARE;END IF;
 IF NOT FOUND OR actor.disabled_at IS NOT NULL OR actor.role IS DISTINCT FROM 'super_admin' THEN
  RAISE EXCEPTION 'Super admin unavailable' USING ERRCODE='42501';
 END IF;
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_internal_admin_profile(p_target_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'district_id',p.district_id,
  'created_at',p.created_at,'disabled_at',p.disabled_at,'updated_at',p.updated_at,'email',a.email,
  'districts',CASE WHEN d.id IS NULL THEN null ELSE jsonb_build_object('name_uz',d.name_uz,'name_ru',d.name_ru,
    'region_id',d.region_id,'regions',CASE WHEN r.id IS NULL THEN null ELSE jsonb_build_object('name_uz',r.name_uz,'name_ru',r.name_ru) END) END)
 FROM public.admin_profiles p LEFT JOIN auth.users a ON a.id=p.id
 LEFT JOIN public.districts d ON d.id=p.district_id LEFT JOIN public.regions r ON r.id=d.region_id WHERE p.id=p_target_id;
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_internal_admin_input(p_profile jsonb,p_creation boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE col text;district integer;role text;name text;email text;
BEGIN
 IF p_profile IS NULL OR jsonb_typeof(p_profile)<>'object' THEN RAISE EXCEPTION 'Invalid profile' USING ERRCODE='22023';END IF;
 FOR col IN SELECT jsonb_object_keys(p_profile) LOOP
  IF col NOT IN ('full_name','role','district_id') AND NOT(p_creation AND col='email') THEN RAISE EXCEPTION 'Invalid field' USING ERRCODE='22023';END IF;
 END LOOP;
 role:=p_profile->>'role';name:=p_profile->>'full_name';
 IF role IS NULL OR role NOT IN ('super_admin','hokimlik_assistant') OR name IS NULL OR length(trim(name)) NOT BETWEEN 1 AND 120
    OR jsonb_typeof(p_profile->'full_name')<>'string' THEN RAISE EXCEPTION 'Invalid profile' USING ERRCODE='22023';END IF;
 BEGIN district:=(p_profile->>'district_id')::integer;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Invalid district' USING ERRCODE='22023';END;
 IF (role='super_admin' AND district IS NOT NULL) OR (role='hokimlik_assistant' AND (district IS NULL OR district<1)) THEN
  RAISE EXCEPTION 'Invalid district' USING ERRCODE='22023';
 END IF;
 IF district IS NOT NULL THEN
  PERFORM id FROM public.districts WHERE id=district FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'District unavailable' USING ERRCODE='22023';END IF;
 END IF;
 IF p_creation THEN
  email:=p_profile->>'email';
  IF email IS NULL OR length(email)>254 OR email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR email<>lower(trim(email)) THEN
   RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023';
  END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_admin_list_profiles(p_actor_id uuid,p_page integer,p_state text,p_search text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.ishdasiz_internal_super_admin(p_actor_id,false);
 IF p_page IS NULL OR p_page<0 OR p_page>100000 OR p_state IS NULL OR p_state NOT IN ('all','active','disabled')
    OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Invalid filter' USING ERRCODE='22023';END IF;
 WITH filtered AS MATERIALIZED (
  SELECT p.id,p.created_at FROM public.admin_profiles p LEFT JOIN auth.users a ON a.id=p.id
  WHERE (p_state='all' OR (p_state='active' AND p.disabled_at IS NULL) OR (p_state='disabled' AND p.disabled_at IS NOT NULL))
    AND (p_search='' OR strpos(lower(COALESCE(p.full_name,'')||' '||COALESCE(a.email,'')),lower(p_search))>0)
 ), page AS (
  SELECT id,created_at FROM filtered ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 50 OFFSET p_page*50
 )
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'admins',COALESCE(
  (SELECT jsonb_agg(public.ishdasiz_internal_admin_profile(id) ORDER BY created_at DESC NULLS LAST,id DESC) FROM page),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_reserve_creation(p_actor_id uuid,p_request_id uuid,p_fingerprint text,p_profile jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reservation public.admin_creation_requests%ROWTYPE;
BEGIN
 -- Every management writer takes this lock before profile rows. It serializes
 -- changes to the active-super-admin set and duplicate creation reservations.
 PERFORM pg_advisory_xact_lock(714007,1);
 PERFORM public.ishdasiz_internal_super_admin(p_actor_id);
 IF p_request_id IS NULL OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';END IF;
 PERFORM public.ishdasiz_internal_admin_input(p_profile,true);
 INSERT INTO public.admin_creation_requests(request_id,actor_id,fingerprint,profile)
 VALUES(p_request_id,p_actor_id,p_fingerprint,p_profile) ON CONFLICT(request_id) DO NOTHING;
 SELECT * INTO reservation FROM public.admin_creation_requests WHERE request_id=p_request_id FOR UPDATE;
 IF reservation.actor_id<>p_actor_id THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501';END IF;
 IF reservation.fingerprint<>p_fingerprint OR reservation.profile IS DISTINCT FROM p_profile THEN RAISE EXCEPTION 'Request changed' USING ERRCODE='40001';END IF;
 IF reservation.state='completed' THEN
  IF NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE id=reservation.target_id) THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='P0002';END IF;
  RETURN jsonb_build_object('profile',public.ishdasiz_internal_admin_profile(reservation.target_id));
 END IF;
 IF reservation.lease_until>clock_timestamp() THEN RAISE EXCEPTION 'Creation in progress' USING ERRCODE='55P03';END IF;
 UPDATE public.admin_creation_requests SET lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 WHERE request_id=p_request_id RETURNING * INTO reservation;
 RETURN jsonb_build_object('target_id',reservation.target_id,'lease_id',reservation.lease_id);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_complete_creation(p_actor_id uuid,p_request_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reservation public.admin_creation_requests%ROWTYPE; target public.admin_profiles%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(714007,1);
 PERFORM public.ishdasiz_internal_super_admin(p_actor_id);
 SELECT * INTO reservation FROM public.admin_creation_requests WHERE request_id=p_request_id AND actor_id=p_actor_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='P0002';END IF;
 IF reservation.state='completed' THEN RETURN public.ishdasiz_internal_admin_profile(reservation.target_id);END IF;
 IF p_lease_id IS NULL OR reservation.lease_id IS DISTINCT FROM p_lease_id THEN RAISE EXCEPTION 'Creation changed' USING ERRCODE='40001';END IF;
 PERFORM public.ishdasiz_internal_admin_input(reservation.profile,true);
 IF NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=reservation.target_id AND lower(a.email)=reservation.profile->>'email'
  AND a.email_confirmed_at IS NOT NULL AND a.raw_app_meta_data->>'ishdasiz_admin_request'=p_request_id::text
  AND a.raw_app_meta_data->>'ishdasiz_admin_actor'=p_actor_id::text) THEN RAISE EXCEPTION 'Authentication record unavailable' USING ERRCODE='40001';END IF;
 IF EXISTS(SELECT 1 FROM public.admin_profiles WHERE id=reservation.target_id) THEN RAISE EXCEPTION 'Profile already exists' USING ERRCODE='40001';END IF;
 INSERT INTO public.admin_profiles(id,full_name,role,district_id)
 VALUES(reservation.target_id,reservation.profile->>'full_name',reservation.profile->>'role',(reservation.profile->>'district_id')::integer) RETURNING * INTO target;
 INSERT INTO public.admin_profile_actions(actor_id,target_id,action,resulting_access)
 VALUES(p_actor_id,target.id,'create',jsonb_build_object('role',target.role,'district_id',target.district_id,'disabled',false));
 UPDATE public.admin_creation_requests SET state='completed',completed_at=clock_timestamp(),lease_id=null,lease_until=null WHERE request_id=p_request_id;
 RETURN public.ishdasiz_internal_admin_profile(target.id);
END $$;
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_release_creation(p_actor_id uuid,p_request_id uuid,p_lease_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE public.admin_creation_requests SET lease_id=null,lease_until=null
 WHERE request_id=p_request_id AND actor_id=p_actor_id AND lease_id=p_lease_id AND state='reserved';
$$;
CREATE OR REPLACE FUNCTION public.ishdasiz_admin_update_profile(p_actor_id uuid,p_target_id uuid,p_action text,p_payload jsonb,p_expected_version timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target public.admin_profiles%ROWTYPE;next_role text;next_district integer;next_name text;next_disabled timestamptz;before_access jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(714007,1);
 PERFORM public.ishdasiz_internal_super_admin(p_actor_id);
 IF p_target_id IS NULL OR p_action IS NULL OR p_action NOT IN ('edit','disable','enable') OR p_expected_version IS NULL
    OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023';END IF;
 SELECT * INTO target FROM public.admin_profiles WHERE id=p_target_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='P0002';END IF;
 next_role:=target.role;next_district:=target.district_id;next_name:=target.full_name;next_disabled:=target.disabled_at;
 IF p_action='edit' THEN
  PERFORM public.ishdasiz_internal_admin_input(p_payload);
  next_role:=p_payload->>'role';next_district:=(p_payload->>'district_id')::integer;next_name:=trim(p_payload->>'full_name');
 ELSE
  IF p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid fields' USING ERRCODE='22023';END IF;
  IF p_action='disable' THEN next_disabled:=COALESCE(target.disabled_at,clock_timestamp());
  ELSE
   PERFORM public.ishdasiz_internal_admin_input(jsonb_build_object('full_name',target.full_name,'role',target.role,'district_id',target.district_id));next_disabled:=null;
  END IF;
 END IF;
 IF p_actor_id=p_target_id AND (next_role IS DISTINCT FROM 'super_admin' OR next_disabled IS NOT NULL) THEN RAISE EXCEPTION 'Cannot remove own access' USING ERRCODE='42501';END IF;
 IF target.role='super_admin' AND target.disabled_at IS NULL AND (next_role IS DISTINCT FROM 'super_admin' OR next_disabled IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM public.admin_profiles WHERE id<>p_target_id AND role='super_admin' AND disabled_at IS NULL) THEN
  RAISE EXCEPTION 'Last super admin' USING ERRCODE='42501';
 END IF;
 -- Identical retries return the current profile without resurrecting access or
 -- overwriting subsequent changes. Differing stale edits remain conflicts.
 IF target.role IS NOT DISTINCT FROM next_role AND target.district_id IS NOT DISTINCT FROM next_district
    AND target.full_name IS NOT DISTINCT FROM next_name AND target.disabled_at IS NOT DISTINCT FROM next_disabled THEN
  RETURN public.ishdasiz_internal_admin_profile(target.id);
 END IF;
 IF target.updated_at IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Profile changed' USING ERRCODE='40001';END IF;
 before_access:=jsonb_build_object('role',target.role,'district_id',target.district_id,'disabled',target.disabled_at IS NOT NULL);
 UPDATE public.admin_profiles SET full_name=next_name,role=next_role,district_id=next_district,disabled_at=next_disabled WHERE id=target.id RETURNING * INTO target;
 INSERT INTO public.admin_profile_actions(actor_id,target_id,action,previous_access,resulting_access)
 VALUES(p_actor_id,p_target_id,p_action,before_access,jsonb_build_object('role',target.role,'district_id',target.district_id,'disabled',target.disabled_at IS NOT NULL));
 RETURN public.ishdasiz_internal_admin_profile(target.id);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_internal_super_admin(uuid,boolean),public.ishdasiz_internal_admin_profile(uuid),public.ishdasiz_internal_admin_input(jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.ishdasiz_admin_list_profiles(uuid,integer,text,text),public.ishdasiz_admin_reserve_creation(uuid,uuid,text,jsonb),public.ishdasiz_admin_complete_creation(uuid,uuid,uuid),public.ishdasiz_admin_release_creation(uuid,uuid,uuid),public.ishdasiz_admin_update_profile(uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_admin_list_profiles(uuid,integer,text,text),public.ishdasiz_admin_reserve_creation(uuid,uuid,text,jsonb),public.ishdasiz_admin_complete_creation(uuid,uuid,uuid),public.ishdasiz_admin_release_creation(uuid,uuid,uuid),public.ishdasiz_admin_update_profile(uuid,uuid,text,jsonb,timestamptz) TO service_role;
COMMIT;
