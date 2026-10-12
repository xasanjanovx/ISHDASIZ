-- Synthetic snapshot of the legacy schema expected by the October release.
-- NOT a fresh-install migration or a dump of the live database. Repair columns,
-- functions and tables must come from the actual release migrations, not here.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text UNIQUE,email_confirmed_at timestamptz,raw_app_meta_data jsonb DEFAULT '{}');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),password_hash text,phone text,telegram_user_id bigint);
CREATE TABLE otp_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),phone text,code text,verified boolean);
CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,full_name text,phone text,updated_at timestamptz DEFAULT now());
CREATE TABLE employer_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,company_name text,is_verified boolean DEFAULT false,updated_at timestamptz DEFAULT now());
CREATE TABLE regions(id integer PRIMARY KEY,slug text,name_uz text,name_ru text);
CREATE TABLE districts(id integer PRIMARY KEY,region_id integer REFERENCES regions(id),name_uz text,name_ru text);
CREATE TABLE categories(id uuid PRIMARY KEY,name_uz text,name_ru text);
CREATE TABLE admin_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text,role text CHECK(role IN ('super_admin','hokimlik_assistant')),district_id integer REFERENCES districts(id),created_at timestamptz DEFAULT now());
CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text DEFAULT 'local',source_id text,is_imported boolean DEFAULT false,source_status text DEFAULT 'active',
 source_url text,employer_id uuid REFERENCES employer_profiles(id),user_id uuid,created_by uuid,title_uz text,title_ru text,description_uz text NOT NULL DEFAULT '',description_ru text NOT NULL DEFAULT '',company_name text,
 category_id uuid REFERENCES categories(id),region_id integer,district_id integer,salary_min integer,salary_max integer,employment_type text,latitude double precision,longitude double precision,address text,
 contact_phone text,contact_telegram text,requirements_uz text,requirements_ru text,benefits text,experience text,education_level text,gender text,age_min integer,age_max integer,
 languages jsonb,skills jsonb,is_for_students boolean DEFAULT false,is_for_disabled boolean DEFAULT false,is_for_women boolean DEFAULT false,payment_type integer,work_mode text,
 status text DEFAULT 'active',is_active boolean DEFAULT true,views_count integer DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 raw_source_json jsonb,last_seen_at timestamptz,last_synced_at timestamptz,last_checked_at timestamptz,UNIQUE(source,source_id));
CREATE TABLE resumes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),status text,is_public boolean,post_to_channel boolean,
 title text,full_name text,phone text,telegram text,about text,birth_date date,city text,region_id integer,district_id integer,category_id uuid,
 skills text[],languages text[],experience text,experience_years integer,education_level text,gender text,expected_salary_min integer,expected_salary_max integer,
 views_count integer DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE job_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid REFERENCES jobs(id),status text DEFAULT 'pending',user_id uuid,resume_id uuid REFERENCES resumes(id),full_name text,phone text,message text,created_at timestamptz DEFAULT now());
CREATE TABLE favorites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),job_id uuid REFERENCES jobs(id),created_at timestamptz DEFAULT now(),UNIQUE(user_id,job_id));
CREATE TABLE view_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),job_id uuid REFERENCES jobs(id),viewed_at timestamptz DEFAULT now(),UNIQUE(user_id,job_id));
CREATE TABLE telegram_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
CREATE TABLE conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user1_id uuid REFERENCES users(id),user2_id uuid REFERENCES users(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user1_id,user2_id));
CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES conversations(id),sender_id uuid REFERENCES users(id),content text,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());
CREATE TABLE ai_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),messages jsonb);
-- Deliberately permissive legacy access, including column grants. The release
-- must remove private access without relying on a clean initial installation.
GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC,anon,authenticated,service_role;
GRANT SELECT(password_hash) ON users TO anon;
GRANT SELECT(code) ON otp_codes TO authenticated;
GRANT SELECT(messages) ON ai_sessions TO anon;
CREATE POLICY legacy_jobs_read ON jobs FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY legacy_resumes_read ON resumes FOR SELECT TO anon,authenticated USING(true);
