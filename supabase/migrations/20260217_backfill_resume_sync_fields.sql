-- Backfill resume fields so bot-created resumes are consistent on frontend.

ALTER TABLE IF EXISTS resumes
  ADD COLUMN IF NOT EXISTS desired_position TEXT,
  ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;

-- Keep a stable display title for web cards/details.
UPDATE resumes
SET desired_position = COALESCE(NULLIF(desired_position, ''), NULLIF(title, ''), NULLIF(field_title, ''), desired_position)
WHERE desired_position IS NULL OR desired_position = '';

-- Ensure title is also populated when older rows only have desired/field titles.
UPDATE resumes
SET title = COALESCE(NULLIF(title, ''), NULLIF(desired_position, ''), NULLIF(field_title, ''), title)
WHERE title IS NULL OR title = '';

-- Derive coarse numeric experience_years for legacy bot values.
UPDATE resumes
SET experience_years = CASE
  WHEN lower(coalesce(experience, '')) IN ('1', '0', 'no_experience', 'tajribasiz', 'без опыта', 'talab etilmaydi') THEN 0
  WHEN lower(coalesce(experience, '')) IN ('2', '1_year', '1 yil', '1 год', '1 yilgacha', 'до 1 года') THEN 1
  WHEN lower(coalesce(experience, '')) IN ('3', '3_years', '1_3_years', '1-3 yil', '1-3 года') THEN 2
  WHEN lower(coalesce(experience, '')) IN ('4', '5_years', '3_5_years', '3-5 yil', '3-5 лет') THEN 4
  WHEN lower(coalesce(experience, '')) IN ('5', '10_years', '5_plus', '5+ yil', '5+ лет', '5 yildan ortiq') THEN 6
  ELSE experience_years
END
WHERE coalesce(experience_years, 0) = 0
  AND experience IS NOT NULL
  AND experience <> '';

