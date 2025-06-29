import { create } from 'zustand';
import { getSupabaseClient, handleSupabaseError } from '@reelapps/auth';
import { User } from '@supabase/supabase-js';
import { Database } from '@reelapps/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string, role?: 'candidate' | 'recruiter') => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  isAuthenticated: false,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      console.log('Starting login process...');
      
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        handleSupabaseError(error, 'Login');
      }

      if (data.user) {
        console.log('User authenticated successfully:', data.user.id);
        set({ user: data.user, isAuthenticated: true });
        
        // Wait for auth state to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fetch user profile
        await get().refreshProfile();
      }
    } catch (error) {
      console.error('Login process failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (email: string, password: string, firstName: string, lastName: string, role: 'candidate' | 'recruiter' = 'candidate') => {
    set({ isLoading: true });
    try {
      console.log('Starting signup process...');
      
      // Step 1: Create the auth user with metadata
      const supabase = getSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role
          }
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        handleSupabaseError(authError, 'Signup');
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      console.log('Auth user created successfully:', authData.user.id);
      set({ user: authData.user, isAuthenticated: true });

      // Step 2: Create profile manually since we can't rely on triggers
      console.log('Creating profile manually...');
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: firstName,
          last_name: lastName,
          email: authData.user.email
        })
        .select()
        .single();

      if (createError) {
        console.error('Profile creation error:', createError);
        // Don't throw here - user is created, just profile failed
        // The user can still use the app and profile can be created later
        set({ profile: null, isLoading: false });
        return;
      }

      console.log('Profile created successfully:', newProfile);
      set({ profile: newProfile, isLoading: false });

      // If session is null (e.g., email confirmation flow is enabled) automatically sign the user in so that
      // subsequent API calls have a valid JWT.
      if (!authData.session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('Auto sign-in after signup failed:', signInError);
        }

        if (signInData?.user) {
          set({ user: signInData.user, isAuthenticated: true });
        }
      }

    } catch (error) {
      console.error('Signup process failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },
  
  logout: async () => {
    try {
      console.log('Starting logout process...');
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        handleSupabaseError(error, 'Logout');
      }
      set({ user: null, profile: null, isAuthenticated: false });
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
  
  setUser: (user) => {
    console.log('Setting user:', user?.id || 'null');
    set({ user, isAuthenticated: !!user });
  },

  setProfile: (profile) => {
    console.log('Setting profile:', profile?.id || 'null');
    set({ profile });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) {
      console.log('No user found, skipping profile refresh');
      set({ isLoading: false });
      return;
    }

    try {
      console.log('Refreshing profile for user:', user.id);
      
      const supabase = getSupabaseClient();
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error refreshing profile:', error);
        set({ isLoading: false });
        return;
      }

      if (!profile) {
        console.log('No profile found, creating default profile...');
        const userData = user.user_metadata || {};
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            first_name: userData.first_name || 'User',
            last_name: userData.last_name || 'Name',
            email: user.email
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating default profile:', createError);
          set({ profile: null, isAuthenticated: true, isLoading: false });
          return;
        }

        console.log('Default profile created:', newProfile);
        set({ profile: newProfile, isAuthenticated: true, isLoading: false });
      } else {
        console.log('Profile found:', profile);
        set({ profile, isAuthenticated: true, isLoading: false });
      }
    } catch (error) {
      console.error('Profile refresh error:', error);
      set({ isLoading: false });
    }
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      console.log('Initializing auth store...');
      
      const supabase = getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session error:', error);
        set({ isLoading: false });
        return;
      }

      if (session?.user) {
        console.log('Found existing session for user:', session.user.id);
        set({ user: session.user, isAuthenticated: true });
        await get().refreshProfile();
      } else {
        console.log('No existing session found');
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Initialize error:', error);
      set({ isLoading: false });
    }
  },

  sendPasswordResetEmail: async (email: string) => {
    set({ isLoading: true });
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/password-reset`,
      });

      if (error) {
        handleSupabaseError(error, 'Password Reset');
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));

/*****************************************************************
 * Session watcher – silently refresh JWT every 50 minutes so that
 * background tabs do not lose authentication.                    *
 *****************************************************************/
let sessionWatcherStarted = false;
export const startSessionWatcher = () => {
  if (sessionWatcherStarted) return;
  sessionWatcherStarted = true;
  // Refresh right before the typical 60-minute expiry window.
  const FIFTY_MINUTES = 50 * 60 * 1000;
  setInterval(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('Silent session refresh failed', error.message);
        return;
      }
      if (data?.session?.user) {
        // Update store so that latest user metadata is available.
        useAuthStore.getState().setUser(data.session.user);
      }
    } catch (err) {
      console.warn('Silent session refresh threw', err);
    }
  }, FIFTY_MINUTES);
};

// Listen for auth changes with improved error handling
const supabase = getSupabaseClient();
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state change:', event, session?.user?.id || 'no user');
  
  const { setUser, refreshProfile } = useAuthStore.getState();
  
  if (event === 'SIGNED_IN' && session?.user) {
    setUser(session.user);
    await refreshProfile();
  } else if (event === 'SIGNED_OUT') {
    setUser(null);
    useAuthStore.setState({ profile: null });
  } else if (event === 'TOKEN_REFRESHED' && session?.user) {
    setUser(session.user);
  }
});