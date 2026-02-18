-- Channel autopost outbox for jobs/resumes.
-- Covers create/update/deactivate/delete across all write paths (site, bot, imports, direct DB writes).

CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'resume')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upsert', 'deactivate', 'delete')),
  region_id BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_status_next_retry
  ON sync_events(status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_sync_events_entity
  ON sync_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'resume')),
  entity_id UUID NOT NULL,
  channel_username TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  message_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, channel_username)
);

CREATE INDEX IF NOT EXISTS idx_channel_posts_entity
  ON channel_posts(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS sync_worker_locks (
  worker_name TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_sync_events_updated_at ON sync_events;
    CREATE TRIGGER trg_sync_events_updated_at
      BEFORE UPDATE ON sync_events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_channel_posts_updated_at ON channel_posts;
    CREATE TRIGGER trg_channel_posts_updated_at
      BEFORE UPDATE ON channel_posts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION acquire_worker_lock(
  p_name TEXT,
  p_ttl_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO sync_worker_locks(worker_name, locked_until, updated_at)
  VALUES (p_name, v_now + make_interval(secs => GREATEST(30, p_ttl_seconds)), v_now)
  ON CONFLICT (worker_name)
  DO UPDATE SET
    locked_until = EXCLUDED.locked_until,
    updated_at = EXCLUDED.updated_at
  WHERE sync_worker_locks.locked_until IS NULL
    OR sync_worker_locks.locked_until < v_now;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_worker_lock(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sync_worker_locks
  SET locked_until = now(),
      updated_at = now()
  WHERE worker_name = p_name;
END;
$$;

CREATE OR REPLACE FUNCTION enqueue_job_sync_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_action TEXT;
  v_region_id BIGINT;
  v_entity_id UUID;
  v_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      OLD.is_active IS DISTINCT FROM NEW.is_active OR
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.region_id IS DISTINCT FROM NEW.region_id OR
      OLD.district_id IS DISTINCT FROM NEW.district_id OR
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.title_uz IS DISTINCT FROM NEW.title_uz OR
      OLD.title_ru IS DISTINCT FROM NEW.title_ru OR
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.description_uz IS DISTINCT FROM NEW.description_uz OR
      OLD.description_ru IS DISTINCT FROM NEW.description_ru OR
      OLD.requirements_uz IS DISTINCT FROM NEW.requirements_uz OR
      OLD.requirements_ru IS DISTINCT FROM NEW.requirements_ru OR
      OLD.company_name IS DISTINCT FROM NEW.company_name OR
      OLD.address IS DISTINCT FROM NEW.address OR
      OLD.salary_min IS DISTINCT FROM NEW.salary_min OR
      OLD.salary_max IS DISTINCT FROM NEW.salary_max OR
      OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR
      OLD.contact_telegram IS DISTINCT FROM NEW.contact_telegram OR
      OLD.hr_name IS DISTINCT FROM NEW.hr_name OR
      OLD.gender IS DISTINCT FROM NEW.gender OR
      OLD.education_level IS DISTINCT FROM NEW.education_level OR
      OLD.experience IS DISTINCT FROM NEW.experience OR
      OLD.age_min IS DISTINCT FROM NEW.age_min OR
      OLD.age_max IS DISTINCT FROM NEW.age_max OR
      OLD.work_mode IS DISTINCT FROM NEW.work_mode OR
      OLD.employment_type IS DISTINCT FROM NEW.employment_type OR
      OLD.working_days IS DISTINCT FROM NEW.working_days OR
      OLD.working_hours IS DISTINCT FROM NEW.working_hours OR
      OLD.benefits IS DISTINCT FROM NEW.benefits OR
      OLD.languages IS DISTINCT FROM NEW.languages OR
      OLD.is_for_students IS DISTINCT FROM NEW.is_for_students OR
      OLD.is_for_graduates IS DISTINCT FROM NEW.is_for_graduates OR
      OLD.is_for_disabled IS DISTINCT FROM NEW.is_for_disabled OR
      OLD.is_for_women IS DISTINCT FROM NEW.is_for_women
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_region_id := OLD.region_id;
    v_entity_id := OLD.id;
  ELSE
    v_active := COALESCE(NEW.is_active, FALSE) AND COALESCE(NEW.status, 'active') = 'active';
    v_action := CASE WHEN v_active THEN 'upsert' ELSE 'deactivate' END;
    v_region_id := COALESCE(NEW.region_id, OLD.region_id);
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO sync_events(entity_type, entity_id, action, region_id, payload, status, next_retry_at)
  VALUES (
    'job',
    v_entity_id,
    v_action,
    v_region_id,
    jsonb_build_object(
      'source', CASE WHEN TG_OP = 'DELETE' THEN OLD.source ELSE NEW.source END,
      'status', CASE WHEN TG_OP = 'DELETE' THEN OLD.status ELSE NEW.status END,
      'is_active', CASE WHEN TG_OP = 'DELETE' THEN OLD.is_active ELSE NEW.is_active END
    ),
    'pending',
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION enqueue_resume_sync_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_action TEXT;
  v_region_id BIGINT;
  v_entity_id UUID;
  v_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      OLD.is_public IS DISTINCT FROM NEW.is_public OR
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.region_id IS DISTINCT FROM NEW.region_id OR
      OLD.district_id IS DISTINCT FROM NEW.district_id OR
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.desired_position IS DISTINCT FROM NEW.desired_position OR
      OLD.field_title IS DISTINCT FROM NEW.field_title OR
      OLD.full_name IS DISTINCT FROM NEW.full_name OR
      OLD.about IS DISTINCT FROM NEW.about OR
      OLD.skills IS DISTINCT FROM NEW.skills OR
      OLD.languages IS DISTINCT FROM NEW.languages OR
      OLD.experience IS DISTINCT FROM NEW.experience OR
      OLD.experience_level IS DISTINCT FROM NEW.experience_level OR
      OLD.experience_years IS DISTINCT FROM NEW.experience_years OR
      OLD.education_level IS DISTINCT FROM NEW.education_level OR
      OLD.gender IS DISTINCT FROM NEW.gender OR
      OLD.expected_salary_min IS DISTINCT FROM NEW.expected_salary_min OR
      OLD.expected_salary_max IS DISTINCT FROM NEW.expected_salary_max OR
      OLD.special IS DISTINCT FROM NEW.special
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_region_id := OLD.region_id;
    v_entity_id := OLD.id;
  ELSE
    v_active := COALESCE(NEW.is_public, FALSE) AND COALESCE(NEW.status, 'active') = 'active';
    v_action := CASE WHEN v_active THEN 'upsert' ELSE 'deactivate' END;
    v_region_id := COALESCE(NEW.region_id, OLD.region_id);
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO sync_events(entity_type, entity_id, action, region_id, payload, status, next_retry_at)
  VALUES (
    'resume',
    v_entity_id,
    v_action,
    v_region_id,
    jsonb_build_object(
      'status', CASE WHEN TG_OP = 'DELETE' THEN OLD.status ELSE NEW.status END,
      'is_public', CASE WHEN TG_OP = 'DELETE' THEN OLD.is_public ELSE NEW.is_public END
    ),
    'pending',
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_jobs_events ON jobs;
CREATE TRIGGER trg_sync_jobs_events
AFTER INSERT OR UPDATE OR DELETE ON jobs
FOR EACH ROW
EXECUTE FUNCTION enqueue_job_sync_event();

DROP TRIGGER IF EXISTS trg_sync_resumes_events ON resumes;
CREATE TRIGGER trg_sync_resumes_events
AFTER INSERT OR UPDATE OR DELETE ON resumes
FOR EACH ROW
EXECUTE FUNCTION enqueue_resume_sync_event();

