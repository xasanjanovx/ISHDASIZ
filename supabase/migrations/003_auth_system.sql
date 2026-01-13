-- Complete Auth System Tables Migration
-- Run this in Supabase SQL Editor

-- Drop and recreate OTP table with 5-digit codes
DROP TABLE IF EXISTS otp_codes CASCADE;

CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(5) NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_codes(phone);

-- Security
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role access" ON otp_codes 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Allow public (for API routes without auth)
GRANT ALL ON otp_codes TO anon, authenticated, service_role;

-- Ensure users table exists with correct schema
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('job_seeker', 'employer')),
  is_verified BOOLEAN DEFAULT false,
  verified_via VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Ensure job_seeker_profiles table exists
CREATE TABLE IF NOT EXISTS job_seeker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  full_name VARCHAR(255),
  birth_date DATE,
  phone VARCHAR(20),
  city VARCHAR(100),
  photo_url TEXT,
  about TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure employer_profiles table exists
CREATE TABLE IF NOT EXISTS employer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  company_name VARCHAR(255),
  logo_url TEXT,
  industry VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  description TEXT,
  inn VARCHAR(20),
  is_verified BOOLEAN DEFAULT false,
  verified_via VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_seeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_profiles ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all users (for API routes)
CREATE POLICY IF NOT EXISTS "Service role users access" ON users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role job_seeker access" ON job_seeker_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
  
CREATE POLICY IF NOT EXISTS "Service role employer access" ON employer_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON users TO anon, authenticated, service_role;
GRANT ALL ON job_seeker_profiles TO anon, authenticated, service_role;
GRANT ALL ON employer_profiles TO anon, authenticated, service_role;
