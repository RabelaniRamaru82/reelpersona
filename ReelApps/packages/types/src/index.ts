export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id?: string;
          first_name: string;
          last_name: string;
          email: string;
          avatar_url?: string;
          headline?: string;
          summary?: string;
          location?: string;
          availability?: 'available' | 'open' | 'not-looking';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          first_name: string;
          last_name: string;
          email: string;
          avatar_url?: string;
          headline?: string;
          summary?: string;
          location?: string;
          availability?: 'available' | 'open' | 'not-looking';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          avatar_url?: string;
          headline?: string;
          summary?: string;
          location?: string;
          availability?: 'available' | 'open' | 'not-looking';
          created_at?: string;
          updated_at?: string;
        };
      };
      skills: {
        Row: {
          id: string;
          profile_id: string;
          name: string;
          category: 'technical' | 'soft' | 'language' | 'certification';
          proficiency: number;
          years_experience: number;
          verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          name: string;
          category: 'technical' | 'soft' | 'language' | 'certification';
          proficiency: number;
          years_experience: number;
          verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          name?: string;
          category?: 'technical' | 'soft' | 'language' | 'certification';
          proficiency?: number;
          years_experience?: number;
          verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          profile_id: string;
          title: string;
          description: string;
          technologies: string[];
          role: string;
          start_date: string;
          end_date?: string;
          impact: string;
          github_url?: string;
          live_url?: string;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          title: string;
          description: string;
          technologies: string[];
          role: string;
          start_date: string;
          end_date?: string;
          impact: string;
          github_url?: string;
          live_url?: string;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          title?: string;
          description?: string;
          technologies?: string[];
          role?: string;
          start_date?: string;
          end_date?: string;
          impact?: string;
          github_url?: string;
          live_url?: string;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      persona_analyses: {
        Row: {
          id: string;
          profile_id: string;
          openness: number;
          conscientiousness: number;
          extraversion: number;
          agreeableness: number;
          neuroticism: number;
          summary: string;
          strengths: string[];
          growth_areas: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          openness: number;
          conscientiousness: number;
          extraversion: number;
          agreeableness: number;
          neuroticism: number;
          summary: string;
          strengths: string[];
          growth_areas: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          openness?: number;
          conscientiousness?: number;
          extraversion?: number;
          agreeableness?: number;
          neuroticism?: number;
          summary?: string;
          strengths?: string[];
          growth_areas?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          profile_id: string;
          reviewer_name: string;
          reviewer_role: string;
          relationship: 'colleague' | 'manager' | 'client' | 'mentor';
          rating: number;
          feedback: string;
          skills: string[];
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          reviewer_name: string;
          reviewer_role: string;
          relationship: 'colleague' | 'manager' | 'client' | 'mentor';
          rating: number;
          feedback: string;
          skills: string[];
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          reviewer_name?: string;
          reviewer_role?: string;
          relationship?: 'colleague' | 'manager' | 'client' | 'mentor';
          rating?: number;
          feedback?: string;
          skills?: string[];
          verified?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

export type User = {
  id: string;
  email?: string;
  user_metadata?: any;
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Skill = Database['public']['Tables']['skills']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type PersonaAnalysis = Database['public']['Tables']['persona_analyses']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];