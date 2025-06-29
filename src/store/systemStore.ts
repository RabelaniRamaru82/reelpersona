import { create } from 'zustand';

interface SystemStatus {
  pythonService: 'healthy' | 'degraded' | 'down' | 'unknown';
  supabaseService: 'healthy' | 'degraded' | 'down' | 'unknown';
  aiService: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastChecked: string;
}

interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
  persistent?: boolean;
}

interface SystemState {
  status: SystemStatus;
  notifications: SystemNotification[];
  isOnboarding: boolean;
  onboardingStep: number;
  addNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  checkSystemHealth: () => Promise<void>;
  startOnboarding: () => void;
  nextOnboardingStep: () => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  status: {
    pythonService: 'unknown',
    supabaseService: 'unknown',
    aiService: 'unknown',
    lastChecked: new Date().toISOString(),
  },
  notifications: [],
  isOnboarding: false,
  onboardingStep: 0,

  addNotification: (notification) => {
    const newNotification: SystemNotification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      dismissed: false,
    };

    set(state => ({
      notifications: [newNotification, ...state.notifications.slice(0, 9)] // Keep max 10 notifications
    }));

    // Auto-dismiss non-persistent notifications after 5 seconds
    if (!notification.persistent) {
      setTimeout(() => {
        get().dismissNotification(newNotification.id);
      }, 5000);
    }
  },

  dismissNotification: (id) => {
    set(state => ({
      notifications: state.notifications.map(n => 
        n.id === id ? { ...n, dismissed: true } : n
      )
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  checkSystemHealth: async () => {
    const newStatus: SystemStatus = {
      pythonService: 'unknown',
      supabaseService: 'unknown',
      aiService: 'unknown',
      lastChecked: new Date().toISOString(),
    };

    try {
      // Check Supabase by making a simple request to the REST API endpoint
      // This doesn't require authentication and just verifies the service is reachable
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      newStatus.supabaseService = response.ok ? 'healthy' : 'degraded';
    } catch {
      newStatus.supabaseService = 'down';
    }

    try {
      // Check Python service health
      const response = await fetch('/api/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      newStatus.pythonService = response.ok ? 'healthy' : 'degraded';
    } catch {
      newStatus.pythonService = 'down';
    }

    // AI service status is inferred from Python service + recent successful calls
    newStatus.aiService = newStatus.pythonService === 'healthy' ? 'healthy' : 'unknown';

    set({ status: newStatus });

    // Add notifications for service issues
    const { addNotification } = get();
    if (newStatus.pythonService === 'down') {
      addNotification({
        type: 'warning',
        title: 'AI Features Temporarily Unavailable',
        message: 'Job analysis and candidate matching are currently offline. Please try again later.',
        persistent: true
      });
    }

    if (newStatus.supabaseService === 'down') {
      addNotification({
        type: 'error',
        title: 'Database Connection Issue',
        message: 'Unable to save or load data. Please check your connection and try again.',
        persistent: true
      });
    }
  },

  startOnboarding: () => {
    set({ isOnboarding: true, onboardingStep: 0 });
  },

  nextOnboardingStep: () => {
    set(state => ({ onboardingStep: state.onboardingStep + 1 }));
  },

  completeOnboarding: () => {
    set({ isOnboarding: false, onboardingStep: 0 });
    localStorage.setItem('reelApps_onboarding_completed', 'true');
  },

  skipOnboarding: () => {
    set({ isOnboarding: false, onboardingStep: 0 });
    localStorage.setItem('reelApps_onboarding_skipped', 'true');
  },
}));

// Initialize system health check on store creation
setTimeout(() => {
  useSystemStore.getState().checkSystemHealth();
}, 1000);

let healthIntervalStarted = false;
const startHealthInterval = () => {
  if (healthIntervalStarted) return;
  healthIntervalStarted = true;
  setInterval(() => {
    useSystemStore.getState().checkSystemHealth();
  }, 5 * 60 * 1000);
};

// Kick off interval immediately on first import
startHealthInterval();