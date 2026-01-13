/*
  # ISHDASIZ Job Portal - Base Tables

  1. New Tables
    - `districts` - Districts and cities of Andijan region
    - `categories` - Job categories

  2. Security
    - Enable RLS on all tables
    - Public read access
*/

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_uz text NOT NULL,
  name_ru text NOT NULL,
  type text NOT NULL DEFAULT 'district' CHECK (type IN ('city', 'district')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Districts are publicly readable"
  ON districts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_uz text NOT NULL,
  name_ru text NOT NULL,
  icon text NOT NULL DEFAULT 'Briefcase',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin profiles table (must be created before jobs for RLS policies)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'hokimlik_assistant' CHECK (role IN ('super_admin', 'hokimlik_assistant')),
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own profile"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins can read all profiles"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.id = auth.uid() AND ap.role = 'super_admin'
    )
  );