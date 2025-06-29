export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
}

export const getConfig = (): AppConfig => {
  return {
    supabase: {
      url: process.env.VITE_SUPABASE_URL || '',
      anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    },
    app: {
      name: 'ReelApps',
      version: '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
    },
  };
};

export const validateConfig = (config: AppConfig): boolean => {
  return !!(config.supabase.url && config.supabase.anonKey);
};