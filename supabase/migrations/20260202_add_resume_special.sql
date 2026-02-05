-- Add special categories to resumes
ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS special JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_resumes_special ON resumes USING GIN (special);
