-- Profile System Migration
-- Run this in Supabase SQL Editor

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('job_seeker', 'employer')),
  is_verified BOOLEAN DEFAULT false,
  verified_via VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Профили соискателей
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

-- Резюме (несколько на одного соискателя)
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  desired_position VARCHAR(255),
  desired_salary_min INTEGER,
  desired_salary_max INTEGER,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills TEXT[] DEFAULT '{}',
  languages JSONB DEFAULT '[]'::jsonb,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Профили работодателей
CREATE TABLE IF NOT EXISTS employer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  company_name VARCHAR(255) NOT NULL,
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

-- Заявки/отклики
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Чаты
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_seeker_id UUID REFERENCES users(id),
  employer_id UUID REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавить в jobs поле верификации работодателя
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_employer_verified BOOLEAN DEFAULT false;

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seeker ON conversations(job_seeker_id);
CREATE INDEX IF NOT EXISTS idx_conversations_employer ON conversations(employer_id);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_seeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow public read for visible resumes
CREATE POLICY "Resumes are viewable by everyone if visible" ON resumes
  FOR SELECT USING (is_visible = true);

-- Allow users to manage their own data
CREATE POLICY "Users can manage own profile" ON job_seeker_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage own employer profile" ON employer_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage own resumes" ON resumes
  FOR ALL USING (user_id = auth.uid());
