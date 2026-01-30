-- Fix jobs.district_id to match districts.id type (INTEGER)
-- districts.id is already INTEGER, but jobs.district_id is still UUID

-- Step 1: Drop views that depend on jobs.district_id
DROP VIEW IF EXISTS jobs_view CASCADE;
DROP VIEW IF EXISTS applications CASCADE;

-- Step 2: Drop foreign key constraint on jobs.district_id
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_district_id_fkey;

-- Step 3: Change jobs.district_id to INTEGER
ALTER TABLE jobs 
  ALTER COLUMN district_id TYPE integer 
  USING NULL; -- Reset values since UUIDs can't be converted to integers

-- Step 4: Recreate foreign key constraint
ALTER TABLE jobs
  ADD CONSTRAINT jobs_district_id_fkey 
  FOREIGN KEY (district_id) 
  REFERENCES districts(id);

-- Step 5: Recreate jobs_view
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

-- Step 6: Recreate applications view
CREATE OR REPLACE VIEW applications AS SELECT * FROM job_applications;

-- Step 7: Grant permissions on views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs_view TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO anon, authenticated, service_role;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'district_id';
