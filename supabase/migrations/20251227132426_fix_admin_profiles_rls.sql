/*
  # Fix Admin Profiles RLS Policy

  1. Changes
    - Drop existing problematic RLS policies that cause circular dependency
    - Create a single combined policy for reading admin profiles
    
  2. Security
    - Authenticated users can read their own profile
    - No circular dependencies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can read own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles" ON admin_profiles;

-- Create a simple policy without circular dependency
CREATE POLICY "Authenticated users can read own admin profile"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
