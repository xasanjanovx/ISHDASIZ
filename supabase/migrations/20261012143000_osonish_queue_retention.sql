-- Retain diagnostic items for seven days, then keep their exact safe summary.
-- Only temporary queue rows are removed; jobs and run/request identities remain.
BEGIN;
ALTER TABLE public.source_import_checkpoints ADD COLUMN IF NOT EXISTS archived_progress jsonb;
REVOKE ALL(archived_progress) ON public.source_import_checkpoints FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_archive_osonish_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid;saved jsonb;
BEGIN
 SELECT r.id INTO target FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id
  WHERE r.source='osonish' AND r.state IN ('completed','failed','abandoned')
   AND r.completed_at<clock_timestamp()-interval '7 days' AND c.protocol_version=2 AND c.archived_progress IS NULL
  ORDER BY r.completed_at,r.id LIMIT 1 FOR UPDATE OF r,c SKIP LOCKED;
 IF NOT FOUND THEN RETURN;END IF;
 saved:=public.ishdasiz_import_summary(target);
 UPDATE public.source_import_checkpoints SET archived_progress=saved WHERE run_id=target;
 DELETE FROM public.source_import_items WHERE run_id=target;
END $$;
REVOKE ALL ON FUNCTION public.ishdasiz_archive_osonish_queue() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ishdasiz_claim_osonish_refresh(p_actor_id uuid DEFAULT NULL,p_run_id uuid DEFAULT NULL,p_request_id uuid DEFAULT NULL,p_start boolean DEFAULT false,p_max_pages integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE claimed jsonb;target uuid;
BEGIN
 claimed:=public.ishdasiz_claim_osonish_import(p_actor_id,p_run_id,p_request_id,p_start,p_max_pages);
 target:=(claimed->'progress'->>'id')::uuid;
 IF claimed->>'token' IS NOT NULL THEN
  UPDATE public.source_import_checkpoints SET protocol_version=2 WHERE run_id=target AND phase='list' AND next_page=1
   AND NOT EXISTS(SELECT 1 FROM public.source_import_items WHERE run_id=target);
  -- At most one old queue per acquired lease, never a live or recent run.
  PERFORM public.ishdasiz_archive_osonish_queue();
 END IF;
 RETURN claimed;
END $$;

-- Public-list candidates are always checked, even if they recently reappeared.
-- Known active/unchecked imports are checked daily; confirmed unavailable IDs
-- outside the public list are checked again after seven days.

CREATE OR REPLACE FUNCTION public.ishdasiz_import_summary(p_run_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(c.archived_progress,jsonb_build_object('id',r.id,'state',r.state,'phase',c.phase,'started_at',r.started_at,'completed_at',r.completed_at,
  'total',c.total,'listed',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id),
  'processed',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id AND state IN ('active','filled','removed')),
  'failed',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id AND state='error'),
  'verified',(SELECT count(*) FROM public.source_import_items WHERE run_id=r.id AND verified),
  'new_imported',c.created_count,'updated',c.updated_count,'skipped_closed',c.skipped_closed,'next_page',c.next_page,'verify_page',c.verify_page,
  'last_error',c.last_error,'next_retry_at',(SELECT min(available_at) FROM public.source_import_items WHERE run_id=r.id AND state='pending'),
  'busy',r.state='running' AND r.lease_until>clock_timestamp()))
 FROM public.source_import_runs r JOIN public.source_import_checkpoints c ON c.run_id=r.id WHERE r.id=p_run_id;
$$;

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
    AND (COALESCE(source_status,'') NOT IN ('filled','removed_at_source') OR last_checked_at IS NULL OR last_checked_at<clock_timestamp()-interval '7 days')
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
NOTIFY pgrst,'reload schema';
COMMIT;
