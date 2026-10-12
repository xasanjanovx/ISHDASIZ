-- A changing public list supplies candidates, never evidence of disappearance.
-- Existing v1 runs retain their original immutable-snapshot protocol.
BEGIN;
ALTER TABLE public.source_import_checkpoints ADD COLUMN IF NOT EXISTS protocol_version integer NOT NULL DEFAULT 1 CHECK(protocol_version IN (1,2));

CREATE OR REPLACE FUNCTION public.ishdasiz_claim_osonish_refresh(p_actor_id uuid DEFAULT NULL,p_run_id uuid DEFAULT NULL,p_request_id uuid DEFAULT NULL,p_start boolean DEFAULT false,p_max_pages integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE claimed jsonb;target uuid;
BEGIN
 claimed:=public.ishdasiz_claim_osonish_import(p_actor_id,p_run_id,p_request_id,p_start,p_max_pages);
 target:=(claimed->'progress'->>'id')::uuid;
 IF claimed->>'token' IS NOT NULL THEN
  UPDATE public.source_import_checkpoints SET protocol_version=2 WHERE run_id=target AND phase='list' AND next_page=1
   AND NOT EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=target);
 END IF;
 RETURN claimed;
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_work(p_run_id uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 RETURN jsonb_build_object('progress',public.ishdasiz_import_summary(run.id),
  'protocol_version',(SELECT protocol_version FROM public.source_import_checkpoints WHERE run_id=run.id),
  'ids',COALESCE((SELECT jsonb_agg(source_id ORDER BY source_id) FROM
   (SELECT source_id FROM public.source_import_items WHERE run_id=run.id AND state='pending' AND available_at<=clock_timestamp() ORDER BY source_id LIMIT 50) batch),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_candidates(p_run_id uuid,p_token uuid,p_page integer,p_ids text[],p_total integer,p_last_page integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;c public.source_import_checkpoints%ROWTYPE;n integer;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 SELECT * INTO c FROM public.source_import_checkpoints WHERE run_id=run.id FOR UPDATE;
 IF NOT FOUND OR c.protocol_version<>2 OR c.phase<>'list' OR p_page IS DISTINCT FROM c.next_page THEN
  RAISE EXCEPTION 'Import page changed' USING ERRCODE='40001';
 END IF;
 IF p_ids IS NULL OR cardinality(p_ids)>100 OR p_total IS NULL OR p_total NOT BETWEEN 0 AND 100000
  OR p_last_page IS NULL OR p_last_page NOT BETWEEN 1 AND c.max_pages OR p_page>c.max_pages
  OR (p_total=0 AND (p_last_page<>1 OR cardinality(p_ids)<>0))
  OR (cardinality(p_ids)=0 AND p_page<p_last_page)
  OR cardinality(p_ids)<>(SELECT count(DISTINCT value) FROM unnest(p_ids) value)
  OR EXISTS(SELECT 1 FROM unnest(p_ids) value WHERE value IS NULL OR CASE WHEN value ~ '^[1-9][0-9]{0,15}$' THEN value::numeric>9007199254740991 ELSE true END) THEN
  RAISE EXCEPTION 'Invalid source page' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.source_import_items(run_id,source_id) SELECT run.id,value FROM unnest(p_ids) value ON CONFLICT DO NOTHING;
 IF p_page>=p_last_page THEN
  -- Include stale imports missing from today's list. Each is checked explicitly;
  -- jobs added after this checkpoint are outside this run and remain untouched.
  INSERT INTO public.source_import_items(run_id,source_id)
   SELECT run.id,source_id FROM public.jobs WHERE source='osonish' AND is_imported=true
    AND CASE WHEN source_id ~ '^[1-9][0-9]{0,15}$' THEN source_id::numeric<=9007199254740991 ELSE false END
   ON CONFLICT DO NOTHING;
 END IF;
 SELECT count(*) INTO n FROM public.source_import_items WHERE run_id=run.id;
 IF n>100000 THEN RAISE EXCEPTION 'Too many source candidates' USING ERRCODE='22023';END IF;
 UPDATE public.source_import_checkpoints SET total=CASE WHEN p_page>=p_last_page THEN n ELSE null END,
  last_page=p_last_page,next_page=p_page+1,consecutive_errors=0,last_error=null,
  phase=CASE WHEN p_page>=p_last_page THEN CASE WHEN n=0 THEN 'verify' ELSE 'details' END ELSE 'list' END WHERE run_id=run.id;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_osonish_refresh_item(p_run_id uuid,p_token uuid,p_source_id text,p_state text,p_payload jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;checked_at timestamptz:=clock_timestamp();
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 IF NOT EXISTS(SELECT 1 FROM public.source_import_checkpoints WHERE run_id=run.id AND protocol_version=2) THEN
  RAISE EXCEPTION 'Import protocol changed' USING ERRCODE='40001';
 END IF;
 PERFORM public.ishdasiz_osonish_item(run.id,p_token,p_source_id,p_state,p_payload);
 -- One unavailable card must not prevent checking the remaining candidates.
 -- Keep its error durable and report the incomplete run only after the queue.
 IF EXISTS(SELECT 1 FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id
  WHERE r.id=run.id AND r.state='failed' AND c.last_error='detail_unavailable') THEN
  UPDATE public.source_import_runs SET state='running',completed_at=null,lease_until=clock_timestamp()+interval '90 seconds' WHERE id=run.id;
  UPDATE public.source_import_checkpoints SET phase=CASE WHEN EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND state='pending') THEN 'details' ELSE 'verify' END,
   last_error=null WHERE run_id=run.id;
 END IF;
 IF p_state<>'retry' THEN
  -- Exact-row metadata capability also permits source checks for closed owners,
  -- without changing their content, ownership or publication choice.
  INSERT INTO public.source_import_visibility_pending(job_id,run_id,payload)
   SELECT id,run.id,jsonb_build_object('source_status',CASE p_state WHEN 'active' THEN 'active' WHEN 'filled' THEN 'filled' ELSE 'removed_at_source' END,
    'last_checked_at',checked_at,'last_synced_at',checked_at,'last_seen_at',CASE WHEN p_state='active' THEN checked_at ELSE last_seen_at END)
   FROM public.jobs WHERE source='osonish' AND is_imported=true AND source_id=p_source_id FOR UPDATE;
  UPDATE public.jobs j SET source_status=p.payload->>'source_status',last_checked_at=(p.payload->>'last_checked_at')::timestamptz,
   last_synced_at=(p.payload->>'last_synced_at')::timestamptz,last_seen_at=(p.payload->>'last_seen_at')::timestamptz
   FROM public.source_import_visibility_pending p WHERE p.run_id=run.id AND j.id=p.job_id;
  DELETE FROM public.source_import_visibility_pending WHERE run_id=run.id;
  UPDATE public.source_import_items SET verified=true WHERE run_id=run.id AND source_id=p_source_id;
 END IF;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;

CREATE OR REPLACE FUNCTION public.ishdasiz_finish_osonish_refresh(p_run_id uuid,p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run public.source_import_runs%ROWTYPE;c public.source_import_checkpoints%ROWTYPE;n integer;errors integer;
BEGIN
 run:=public.ishdasiz_source_run(p_run_id,p_token);
 SELECT * INTO c FROM public.source_import_checkpoints WHERE run_id=run.id FOR UPDATE;
 SELECT count(*) INTO n FROM public.source_import_items WHERE run_id=run.id;
 IF c.run_id IS NULL OR c.protocol_version<>2 OR c.phase<>'verify' OR c.total IS DISTINCT FROM n
  OR EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=run.id AND (state='pending' OR (state<>'error' AND NOT verified))) THEN
  RAISE EXCEPTION 'Details incomplete' USING ERRCODE='40001';
 END IF;
 -- No global absence cleanup: only confirmed per-item outcomes were applied.
 SELECT count(*) INTO errors FROM public.source_import_items WHERE run_id=run.id AND state='error';
 UPDATE public.source_import_checkpoints SET phase='done',last_error=CASE WHEN errors>0 THEN 'detail_unavailable' ELSE null END WHERE run_id=run.id;
 UPDATE public.source_import_runs SET state=CASE WHEN errors>0 THEN 'failed' ELSE 'completed' END,completed_at=clock_timestamp(),lease_until=clock_timestamp(),
  counters=jsonb_build_object('candidate_total',n,'checked',n-errors,'failed',errors,'absence_cleanup',false) WHERE id=run.id;
 RETURN public.ishdasiz_import_summary(run.id);
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_claim_osonish_refresh(uuid,uuid,uuid,boolean,integer),public.ishdasiz_osonish_candidates(uuid,uuid,integer,text[],integer,integer),public.ishdasiz_osonish_refresh_item(uuid,uuid,text,text,jsonb),public.ishdasiz_finish_osonish_refresh(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ishdasiz_claim_osonish_refresh(uuid,uuid,uuid,boolean,integer),public.ishdasiz_osonish_candidates(uuid,uuid,integer,text[],integer,integer),public.ishdasiz_osonish_refresh_item(uuid,uuid,text,text,jsonb),public.ishdasiz_finish_osonish_refresh(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
