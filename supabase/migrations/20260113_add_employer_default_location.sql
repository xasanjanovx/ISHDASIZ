-- Add default location columns to employer_profiles
-- This allows employers to save their location once and reuse it for future vacancies

ALTER TABLE employer_profiles
ADD COLUMN IF NOT EXISTS default_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS default_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS default_address TEXT;

-- Comment for clarity
COMMENT ON COLUMN employer_profiles.default_latitude IS 'Saved default location latitude for auto-filling new vacancies';
COMMENT ON COLUMN employer_profiles.default_longitude IS 'Saved default location longitude for auto-filling new vacancies';
COMMENT ON COLUMN employer_profiles.default_address IS 'Saved default address text for auto-filling new vacancies';
