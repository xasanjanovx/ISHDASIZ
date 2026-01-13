/*
  # Fix Security and Performance Issues

  ## Changes Made
  
  1. **Indexes**
    - Add missing index on `admin_profiles.district_id` foreign key for better query performance
  
  2. **RLS Policy Optimization**
    - Update all policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth functions for each row, improving performance at scale
    - Policies updated:
      - admin_profiles: "Admins can read own profile"
      - admin_profiles: "Super admins can read all profiles" 
      - jobs: "Admins can insert jobs"
      - jobs: "Admins can update jobs"
      - jobs: "Admins can delete jobs"
      - job_applications: "Admins can read applications"
  
  3. **Function Security**
    - Set immutable search_path on functions to prevent search_path manipulation attacks
    - Mark functions with appropriate stability (STABLE/VOLATILE)
    - Functions updated:
      - update_updated_at_column
      - increment_job_views
  
  ## Security Notes
  - All changes maintain existing security model while improving performance
  - No data access changes, only query optimization
*/

-- Add missing index on admin_profiles.district_id foreign key
CREATE INDEX IF NOT EXISTS idx_admin_profiles_district_id ON admin_profiles(district_id);

-- Drop and recreate RLS policies with optimized auth function calls
-- admin_profiles policies
DROP POLICY IF EXISTS "Admins can read own profile" ON admin_profiles;
CREATE POLICY "Admins can read own profile"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Super admins can read all profiles" ON admin_profiles;
CREATE POLICY "Super admins can read all profiles"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.id = (select auth.uid()) AND ap.role = 'super_admin'
    )
  );

-- jobs policies
DROP POLICY IF EXISTS "Admins can insert jobs" ON jobs;
CREATE POLICY "Admins can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update jobs" ON jobs;
CREATE POLICY "Admins can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can delete jobs" ON jobs;
CREATE POLICY "Admins can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = (select auth.uid())
    )
  );

-- job_applications policies
DROP POLICY IF EXISTS "Admins can read applications" ON job_applications;
CREATE POLICY "Admins can read applications"
  ON job_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = (select auth.uid())
    )
  );

-- Fix function search paths and stability
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
   STABLE
   SECURITY INVOKER
   SET search_path = public;

CREATE OR REPLACE FUNCTION increment_job_views(job_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE jobs SET views_count = views_count + 1 WHERE id = job_uuid;
END;
$$ LANGUAGE plpgsql 
   VOLATILE
   SECURITY DEFINER
   SET search_path = public;