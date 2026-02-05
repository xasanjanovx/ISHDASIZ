-- Add experience_level for resume matching and compatibility
ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS experience_level TEXT;
