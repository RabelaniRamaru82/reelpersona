import { useEffect, useState } from 'react'
import { useAuthStore, initializeSupabase } from './lib/auth'
import { AppWrapper } from './components/AppWrapper'
import ReelPersona from './components/ReelPersona'
import './index.css'

function App() {
  const {
    initialize,
    isLoading,
    isInitializing: storeInitializing,
    isAuthenticated,
    user,
    login,
    signup,
    sendPasswordResetEmail,
    error,
  } = useAuthStore();
  const [localInitializing, setLocalInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🚀 APP: Starting initialization...');
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        console.log('🔍 APP: Environment check:', {
          hasSupabaseUrl: !!supabaseUrl,
          hasSupabaseKey: !!supabaseAnonKey,
          url: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING'
        });
        
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Missing Supabase environment variables. Please check your .env file.');
        }
        
        console.log('✅ APP: Initializing Supabase...');
        initializeSupabase(supabaseUrl, supabaseAnonKey);
        
        console.log('✅ APP: Initializing auth store...');
        await initialize();
        
        console.log('✅ APP: Initialization complete');
      } catch (error) {
        console.error('❌ APP: Initialization failed:', error);
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      } finally {
        setLocalInitializing(false);
      }
    };

    init();

    // Force dark mode on the document
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.classList.add('gradient-background');
  }, [initialize]);

  // Show loading state while initializing
  if (localInitializing || storeInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing ReelPersona...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white max-w-md">
          <div className="text-red-400 mb-4">⚠️ Initialization Error</div>
          <p className="text-sm">{initError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppWrapper
      isAuthenticated={isAuthenticated}
      isInitializing={false}
      user={user}
      error={error ?? null}
      onLogin={login}
      onSignup={signup}
      onPasswordReset={sendPasswordResetEmail}
      isLoading={isLoading ?? false}
    >
      <ReelPersona />
    </AppWrapper>
  );
}

export default App