-- Migration: Convert districts.id from UUID to INTEGER
-- This is required to sync with OsonIsh API which uses integer IDs
-- Date: 2026-01-26

-- 0. Drop views that depend on districts
DROP VIEW IF EXISTS jobs_view CASCADE;
DROP VIEW IF EXISTS applications CASCADE;

-- 1. Drop FK constraints that reference districts
ALTER TABLE admin_profiles DROP CONSTRAINT IF EXISTS admin_profiles_district_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_district_id_fkey;
ALTER TABLE job_seeker_profiles DROP CONSTRAINT IF EXISTS job_seeker_profiles_district_id_fkey;
ALTER TABLE employer_profiles DROP CONSTRAINT IF EXISTS employer_profiles_district_id_fkey;
ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_district_id_fkey;

-- 2. Clear all foreign key references (set to NULL)
UPDATE admin_profiles SET district_id = NULL WHERE district_id IS NOT NULL;
UPDATE jobs SET district_id = NULL WHERE district_id IS NOT NULL;
UPDATE job_seeker_profiles SET district_id = NULL WHERE district_id IS NOT NULL;
UPDATE employer_profiles SET district_id = NULL WHERE district_id IS NOT NULL;
UPDATE resumes SET district_id = NULL WHERE district_id IS NOT NULL;

-- 3. Truncate districts table
TRUNCATE TABLE districts CASCADE;

-- 4. Drop old id column and recreate with INTEGER type
ALTER TABLE districts DROP COLUMN id CASCADE;
ALTER TABLE districts ADD COLUMN id INTEGER PRIMARY KEY;

-- 5. Also change referencing columns from UUID to INTEGER
ALTER TABLE admin_profiles DROP COLUMN IF EXISTS district_id;
ALTER TABLE admin_profiles ADD COLUMN district_id INTEGER;

ALTER TABLE jobs DROP COLUMN IF EXISTS district_id;
ALTER TABLE jobs ADD COLUMN district_id INTEGER;

ALTER TABLE job_seeker_profiles DROP COLUMN IF EXISTS district_id;
ALTER TABLE job_seeker_profiles ADD COLUMN district_id INTEGER;

ALTER TABLE employer_profiles DROP COLUMN IF EXISTS district_id;
ALTER TABLE employer_profiles ADD COLUMN district_id INTEGER;

ALTER TABLE resumes DROP COLUMN IF EXISTS district_id;
ALTER TABLE resumes ADD COLUMN district_id INTEGER;

-- 6. Recreate FK constraints
ALTER TABLE admin_profiles ADD CONSTRAINT admin_profiles_district_id_fkey 
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD CONSTRAINT jobs_district_id_fkey 
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE job_seeker_profiles ADD CONSTRAINT job_seeker_profiles_district_id_fkey 
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE employer_profiles ADD CONSTRAINT employer_profiles_district_id_fkey 
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE resumes ADD CONSTRAINT resumes_district_id_fkey 
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL;

-- 7. Add indices for performance
CREATE INDEX IF NOT EXISTS idx_jobs_district_id ON jobs(district_id);
CREATE INDEX IF NOT EXISTS idx_resumes_district_id ON resumes(district_id);

-- 8. Recreate jobs_view
CREATE OR REPLACE VIEW jobs_view AS
SELECT
    j.*,
    ep.company_name AS employer_company_name,
    ep.logo_url AS employer_logo_url,
    ep.website AS employer_website,
    d.name_uz AS district_name_uz,
    d.name_ru AS district_name_ru,
    c.name_uz AS category_name_uz,
    c.name_ru AS category_name_ru
FROM jobs j
LEFT JOIN employer_profiles ep ON j.employer_id = ep.id
LEFT JOIN districts d ON j.district_id = d.id
LEFT JOIN categories c ON j.category_id = c.id;

-- 9. Recreate applications view
CREATE OR REPLACE VIEW applications AS SELECT * FROM job_applications;
