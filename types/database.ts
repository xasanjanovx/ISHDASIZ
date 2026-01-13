// ... (keeping lines 1-3 outside check if possible, but replace tool needs context)
export interface Database {
  public: {
    Tables: {
      regions: {
        Row: {
          id: number;
          name_uz: string;
          name_ru: string;
          slug: string;
        };
        Insert: Omit<Database['public']['Tables']['regions']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['regions']['Insert']>;
      };
      districts: {
        Row: {
          id: string; // Keeping as string to match existing app usage, though DB is int
          name_uz: string;
          name_ru: string;
          type: 'city' | 'district';
          region_id: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['districts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['districts']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name_uz: string;
          name_ru: string;
          icon: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      jobs: {
        Row: {
          id: string;
          title_uz: string;
          title_ru: string;
          description_uz: string;
          description_ru: string;
          company_name: string;
          category_id: string | null;
          district_id: string | null;
          region_id: number | null;
          salary_min: number;
          salary_max: number;
          employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
          latitude: number | null;
          longitude: number | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          requirements_uz: string | null;
          requirements_ru: string | null;
          is_active: boolean;
          views_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          is_for_students: boolean;
          is_for_disabled: boolean;
          is_for_women: boolean;
          is_employer_verified: boolean;
          // Extended fields
          education_level: string | null;
          education: string | null;
          experience: string | null;
          experience_years: number | null;
          age_min: number | null;
          age_max: number | null;
          contact_phone: string | null;
          contact_telegram: string | null;
          employer_id: string | null;
          gender: string | null;
          benefits: string | null;
          languages: Array<{ language: string; level: string }> | null;
        };

        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at' | 'updated_at' | 'views_count'>;
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
      };
      job_applications: {
        Row: {
          id: string;
          job_id: string;
          full_name: string;
          phone: string;
          email: string | null;
          message: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['job_applications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['job_applications']['Insert']>;
      };
      admin_profiles: {
        Row: {
          id: string;
          full_name: string;
          role: 'super_admin' | 'hokimlik_assistant';
          district_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['admin_profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['admin_profiles']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          phone: string;
          role: 'job_seeker' | 'employer';
          is_verified: boolean;
          verified_via: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      job_seeker_profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          birth_date: string | null;
          phone: string | null;
          city: string | null;
          region_id: number | null;
          district_id: string | null;
          photo_url: string | null;
          about: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['job_seeker_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['job_seeker_profiles']['Insert']>;
      };
      employer_profiles: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          logo_url: string | null;
          industry: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          description: string | null;
          inn: string | null;
          region_id: number | null;
          district_id: string | null;
          is_verified: boolean;
          verified_via: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['employer_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['employer_profiles']['Insert']>;
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          full_name: string;
          birth_date: string | null;
          phone: string;
          city: string | null;
          district_id: string | null;
          category_id: string | null;
          employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
          experience: string; // Level: 'no_experience', etc.
          experience_details: ExperienceItem[]; // JSONB detailed list
          experience_years: number;
          education_level: string; // Level: 'higher', etc.
          education: EducationItem[]; // JSONB detailed list
          skills: string[];
          languages: LanguageItem[];
          about: string | null;
          desired_position: string | null;
          expected_salary_min: number | null;
          expected_salary_max: number | null;
          gender: 'male' | 'female' | 'any';
          is_public: boolean;
          status: 'active' | 'draft' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['resumes']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['resumes']['Insert']>;
      };
      applications: {
        Row: {
          id: string;
          job_id: string;
          user_id: string;
          resume_id: string | null;
          status: 'pending' | 'viewed' | 'accepted' | 'rejected';
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['applications']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['applications']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          job_seeker_id: string;
          employer_id: string;
          job_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
    };
  };
}

// JSON field types
export interface ExperienceItem {
  company: string;
  position: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

export interface EducationItem {
  institution: string;
  degree: string;
  field: string | null;
  start_year: number;
  end_year: number | null;
}

export interface LanguageItem {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'native';
}

// Type aliases
export type Region = Database['public']['Tables']['regions']['Row'];
export type District = Database['public']['Tables']['districts']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobApplication = Database['public']['Tables']['job_applications']['Row'];
export type AdminProfile = Database['public']['Tables']['admin_profiles']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type JobSeekerProfile = Database['public']['Tables']['job_seeker_profiles']['Row'];
export type EmployerProfile = Database['public']['Tables']['employer_profiles']['Row'];
export type Resume = Database['public']['Tables']['resumes']['Row'];
export type Application = Database['public']['Tables']['applications']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];

export interface JobWithRelations extends Job {
  categories?: Category | null;
  districts?: District | null;
  regions?: Region | null;
}

export interface ApplicationWithRelations extends Application {
  jobs?: Job | null;
  resumes?: Resume | null;
}

export interface ConversationWithRelations extends Conversation {
  job_seeker?: User | null;
  employer?: User | null;
  jobs?: Job | null;
  last_message?: Message | null;
}
