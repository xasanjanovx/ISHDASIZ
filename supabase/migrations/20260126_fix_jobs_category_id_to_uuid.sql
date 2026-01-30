-- Fix jobs.category_id to match categories.id (UUID)
-- Also fix jobs.region_id to match regions.id (INTEGER)

-- Step 1: Drop ALL views that depend on jobs columns
DROP VIEW IF EXISTS jobs_view CASCADE;
DROP VIEW IF EXISTS applications CASCADE;
DROP VIEW IF EXISTS category_job_counts CASCADE;
DROP VIEW IF EXISTS region_job_counts CASCADE;
DROP VIEW IF EXISTS district_job_counts CASCADE;

-- Step 2: Drop foreign key constraints
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_category_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_region_id_fkey;

-- Step 3: Change jobs.category_id to UUID (matching categories.id)
ALTER TABLE jobs 
  ALTER COLUMN category_id TYPE uuid 
  USING NULL;

-- Step 4: Ensure jobs.region_id is INTEGER (matching regions.id)
ALTER TABLE jobs 
  ALTER COLUMN region_id TYPE integer 
  USING region_id::integer;

-- Step 5: Recreate foreign key constraints
ALTER TABLE jobs
  ADD CONSTRAINT jobs_category_id_fkey 
  FOREIGN KEY (category_id) 
  REFERENCES categories(id);

ALTER TABLE jobs
  ADD CONSTRAINT jobs_region_id_fkey 
  FOREIGN KEY (region_id) 
  REFERENCES regions(id);

-- Step 6: Recreate jobs_view
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

-- Step 7: Recreate applications view
CREATE OR REPLACE VIEW applications AS SELECT * FROM job_applications;

-- Step 8: Recreate category_job_counts view
CREATE OR REPLACE VIEW category_job_counts AS
SELECT 
    c.id,
    c.name_uz,
    c.name_ru,
    c.slug,
    c.icon,
    COALESCE(COUNT(j.id), 0)::integer AS job_count
FROM categories c
LEFT JOIN jobs j ON j.category_id = c.id AND j.status = 'active'
GROUP BY c.id, c.name_uz, c.name_ru, c.slug, c.icon;

-- Step 9: Recreate region_job_counts view
CREATE OR REPLACE VIEW region_job_counts AS
SELECT 
    r.id,
    r.name_uz,
    r.name_ru,
    r.slug,
    COALESCE(COUNT(j.id), 0)::integer AS job_count
FROM regions r
LEFT JOIN jobs j ON j.region_id = r.id AND j.status = 'active'
GROUP BY r.id, r.name_uz, r.name_ru, r.slug;

-- Step 10: Grant permissions on views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs_view TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO anon, authenticated, service_role;
GRANT SELECT ON public.category_job_counts TO anon, authenticated, service_role;
GRANT SELECT ON public.region_job_counts TO anon, authenticated, service_role;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name IN ('category_id', 'region_id', 'district_id');
