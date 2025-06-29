import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';

let supabaseClient: SupabaseClient | null = null;

export const initializeSupabase = (url: string, anonKey: string) => {
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
};

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initializeSupabase first.');
  }
  return supabaseClient;
};

export const handleSupabaseError = (error: any, context: string) => {
  console.error(`[${context}] Supabase error:`, error);
  throw new Error(`${context} failed: ${error.message}`);
};

interface User {
  id: string;
  email?: string;
  user_metadata?: any;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitializing: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    set({ isInitializing: true });
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ 
          user: session.user as User, 
          isAuthenticated: true,
          isInitializing: false 
        });
      } else {
        set({ isInitializing: false });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Initialization failed',
        isInitializing: false 
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      set({ 
        user: data.user as User, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false 
      });
      throw error;
    }
  },

  signup: async (email: string, password: string, firstName: string, lastName: string) => {
    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      });

      if (error) throw error;

      set({ 
        user: data.user as User, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Signup failed',
        isLoading: false 
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      set({ 
        user: null, 
        isAuthenticated: false, 
        error: null 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Logout failed' 
      });
    }
  },

  sendPasswordResetEmail: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) throw error;
      
      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Password reset failed',
        isLoading: false 
      });
      throw error;
    }
  },
}));