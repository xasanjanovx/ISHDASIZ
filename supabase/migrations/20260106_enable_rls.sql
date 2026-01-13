-- Enable RLS on all tables
-- Run this in Supabase SQL Editor

-- Users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Job Seeker Profiles
ALTER TABLE job_seeker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Job seekers can view own profile" ON job_seeker_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Job seekers can update own profile" ON job_seeker_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Job seekers can insert own profile" ON job_seeker_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Employer Profiles
ALTER TABLE employer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view own profile" ON employer_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Employers can update own profile" ON employer_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Employers can insert own profile" ON employer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Resumes
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resumes" ON resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own resumes" ON resumes
  FOR ALL USING (auth.uid() = user_id);

-- Visible resumes can be viewed by employers
CREATE POLICY "Employers can view visible resumes" ON resumes
  FOR SELECT USING (is_visible = true);

-- Applications
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Job seekers can view own applications" ON applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Job seekers can create applications" ON applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Employers can view applications for their jobs
CREATE POLICY "Employers can view applications for their jobs" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = applications.job_id 
      AND jobs.employer_id = auth.uid()
    )
  );

-- Jobs (public read, employer write)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active jobs" ON jobs
  FOR SELECT USING (status = 'active');

CREATE POLICY "Employers can manage own jobs" ON jobs
  FOR ALL USING (employer_id = auth.uid());

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() IN (
      SELECT job_seeker_id FROM conversations WHERE id = conversation_id
      UNION
      SELECT employer_id FROM conversations WHERE id = conversation_id
    )
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = job_seeker_id OR auth.uid() = employer_id
  );

-- Districts (public read)
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view districts" ON districts
  FOR SELECT USING (true);

-- Categories (public read)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);
