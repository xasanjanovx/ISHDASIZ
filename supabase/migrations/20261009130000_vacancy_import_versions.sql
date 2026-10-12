-- Requires the existing vacancy version trigger. Import check timestamps do
-- not change editable content; source_status and raw source content still do.
BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_vacancy_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE metadata text[] := ARRAY['updated_at','views_count','views','last_seen_at','last_synced_at','last_checked_at'];
BEGIN
  IF NEW.status IN ('filled','archived','draft') THEN NEW.is_active:=false; END IF;
  IF (to_jsonb(NEW) - metadata) IS DISTINCT FROM (to_jsonb(OLD) - metadata) THEN
    NEW.updated_at:=greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  ELSE
    NEW.updated_at:=OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
