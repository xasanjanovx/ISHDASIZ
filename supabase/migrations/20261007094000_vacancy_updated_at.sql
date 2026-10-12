BEGIN;
CREATE OR REPLACE FUNCTION public.ishdasiz_vacancy_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('filled','archived','draft') THEN NEW.is_active:=false; END IF;
  IF (to_jsonb(NEW) - ARRAY['updated_at','views_count','views']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at','views_count','views']) THEN
    NEW.updated_at:=greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  ELSE
    NEW.updated_at:=OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ishdasiz_vacancy_updated_at ON public.jobs;
CREATE TRIGGER ishdasiz_vacancy_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.ishdasiz_vacancy_updated_at();
COMMIT;
