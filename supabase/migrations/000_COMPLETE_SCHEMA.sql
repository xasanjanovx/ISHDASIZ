-- ============================================
-- ISHDASIZ - ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ КОЛОНОК
-- НЕ УДАЛЯЕТ СУЩЕСТВУЮЩИЕ ДАННЫЕ!
-- Только ADD COLUMN IF NOT EXISTS
-- ============================================

-- ========================================
-- 1. USERS - добавить колонки паролей
-- ========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ========================================
-- 2. JOB_SEEKER_PROFILES - добавить недостающие колонки
-- ========================================
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS district_id VARCHAR(50);
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS education VARCHAR(100);
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS expected_salary_min INTEGER;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS is_searching BOOLEAN DEFAULT true;
ALTER TABLE job_seeker_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Добавить уникальный constraint если его нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'job_seeker_profiles_user_id_key'
    ) THEN
        ALTER TABLE job_seeker_profiles ADD CONSTRAINT job_seeker_profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- ========================================
-- 3. EMPLOYER_PROFILES - добавить недостающие колонки
-- ========================================
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS director_name VARCHAR(255);
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Добавить уникальный constraint если его нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employer_profiles_user_id_key'
    ) THEN
        ALTER TABLE employer_profiles ADD CONSTRAINT employer_profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- ========================================
-- 4. JOBS - добавить недостающие колонки
-- ========================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements_uz TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements_ru TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_required VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS education_required VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_students BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_disabled BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_for_women BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) DEFAULT 'application';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_telegram VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS applications_count INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ========================================
-- 5. RESUMES - создать если не существует
-- ========================================
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

-- ========================================
-- 6. APPLICATIONS - добавить недостающие колонки
-- ========================================
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_id UUID;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS cover_message TEXT;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS employer_notes TEXT;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ========================================
-- 7. MESSAGES - создать если не существует
-- ========================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ГОТОВО!
-- ========================================
-- Все недостающие колонки добавлены.
-- Существующие данные НЕ затронуты.
