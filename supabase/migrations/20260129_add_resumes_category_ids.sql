-- Add category_ids for multi-category resume support
ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_resumes_category_ids
ON resumes
USING GIN (category_ids);
