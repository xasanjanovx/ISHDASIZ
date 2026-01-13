/*
  # ISHDASIZ Job Portal - Jobs and Applications Tables

  1. New Tables
    - `jobs` - Job listings with location coordinates
    - `job_applications` - Job applications from users

  2. Security
    - Enable RLS on all tables
    - Public read for active jobs
    - Admin write access for jobs
    - Anyone can submit applications
*/

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_uz text NOT NULL,
  title_ru text NOT NULL,
  description_uz text NOT NULL,
  description_ru text NOT NULL,
  company_name text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  salary_min integer DEFAULT 0,
  salary_max integer DEFAULT 0,
  employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
  latitude double precision,
  longitude double precision,
  address text,
  phone text,
  email text,
  requirements_uz text,
  requirements_ru text,
  is_active boolean DEFAULT true,
  views_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active jobs are publicly readable"
  ON jobs FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
    )
  );

-- Job applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit applications"
  ON job_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read applications"
  ON job_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category_id);
CREATE INDEX IF NOT EXISTS idx_jobs_district ON jobs(district_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for jobs updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment job views (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION increment_job_views(job_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE jobs SET views_count = views_count + 1 WHERE id = job_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;