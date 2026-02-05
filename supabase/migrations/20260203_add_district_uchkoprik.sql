-- Add missing district (Uchko'prik tumani) for Farg'ona region
-- Ensure this is idempotent
DO $$
DECLARE
  r_id integer;
  existing_id integer;
  next_id integer;
BEGIN
  SELECT id INTO r_id FROM regions WHERE name_uz ILIKE '%Farg%' LIMIT 1;
  IF r_id IS NULL THEN
    RAISE NOTICE 'Region Fargona not found, skipping insert';
    RETURN;
  END IF;

  SELECT id INTO existing_id FROM districts WHERE lower(replace(name_uz, '''', '')) = lower(replace('Uchko''prik tumani', '''', '')) AND region_id = r_id LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM districts;

  INSERT INTO districts (id, name_uz, name_ru, region_id)
  VALUES (next_id, 'Uchko''prik tumani', 'Uchko''prik tumani', r_id);
END $$;
