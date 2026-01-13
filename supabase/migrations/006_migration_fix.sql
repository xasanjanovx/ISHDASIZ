-- ============================================
-- 006_MIGRATION_FIX.SQL
-- Fix missing tables from "mistake" project
-- and add necessary relationships
-- ============================================

-- 1. Add employer_id to jobs table (Critical for linking jobs to employer profiles)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES employer_profiles(id) ON DELETE SET NULL;

-- 1.1 Add missing columns to employer_profiles (Required for JOBS_VIEW)
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- 2. Create CONVERSATIONS table (Missing in main project)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant1_id, participant2_id)
);

-- 3. Update MESSAGES table (Support conversations)
-- First create if likely missing (idempotent)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Then ensure columns exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- (000 script might have created from_user_id/to_user_id/job_id. We keep them for now or migrate later)

-- 4. Create JOBS_VIEW (Detailed view for frontend)
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

-- 5. Create APPLICATIONS table (If distinct from job_applications, alias it)
-- Note: We generally use job_applications. This creates a view for compatibility if needed.
CREATE OR REPLACE VIEW applications AS SELECT * FROM job_applications;

-- 6. Ensure RESUMES table exists (Redundant check)
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    birth_date DATE,
    phone VARCHAR(20),
    email VARCHAR(255),
    photo_url TEXT,
    city VARCHAR(100),
    district_id VARCHAR(50),
    about TEXT,
    skills TEXT[],
    languages TEXT[],
    experience JSONB,
    education JSONB,
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    employment_type VARCHAR(30),
    is_public BOOLEAN DEFAULT true,
    views INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Grant access (Since RLS is disabled, just ensure public access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
