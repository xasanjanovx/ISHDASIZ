-- Ensure resume fields required by bot/site sync exist in every environment.

ALTER TABLE IF EXISTS resumes
  ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_details JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS special JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS expected_salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS birth_date DATE;

CREATE INDEX IF NOT EXISTS idx_resumes_category_ids_gin ON resumes USING GIN (category_ids);
CREATE INDEX IF NOT EXISTS idx_resumes_experience_details_gin ON resumes USING GIN (experience_details);
CREATE INDEX IF NOT EXISTS idx_resumes_education_gin ON resumes USING GIN (education);
CREATE INDEX IF NOT EXISTS idx_resumes_special_gin ON resumes USING GIN (special);

