-- Resume channel opt-in flag for Telegram autopost.
-- NULL means legacy/default behavior (allowed), FALSE disables channel autopost.

ALTER TABLE IF EXISTS resumes
  ADD COLUMN IF NOT EXISTS post_to_channel BOOLEAN;

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
      OLD.post_to_channel IS DISTINCT FROM NEW.post_to_channel OR
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
    v_active := COALESCE(NEW.is_public, FALSE)
      AND COALESCE(NEW.status, 'active') = 'active'
      AND COALESCE(NEW.post_to_channel, TRUE);
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
      'is_public', CASE WHEN TG_OP = 'DELETE' THEN OLD.is_public ELSE NEW.is_public END,
      'post_to_channel', CASE WHEN TG_OP = 'DELETE' THEN OLD.post_to_channel ELSE NEW.post_to_channel END
    ),
    'pending',
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
