import { createContext, useContext, useEffect, useState, useCallback, PropsWithChildren } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'loading';

type SubscriptionInfo = {
  status: SubscriptionStatus;
  plan: 'basic' | 'pro' | null;
  subscriptionEnd: string | null;
  paymentProvider: 'stripe' | 'paystack' | null;
  trialDaysRemaining: number;
  trialExpired: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: SubscriptionInfo;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  hasFullAccess: boolean;
};

const defaultSubscription: SubscriptionInfo = {
  status: 'loading',
  plan: null,
  subscriptionEnd: null,
  paymentProvider: null,
  trialDaysRemaining: 7,
  trialExpired: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(defaultSubscription);

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setSubscription({ ...defaultSubscription, status: 'trial' });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        // On error, assume trial status
        setSubscription({ ...defaultSubscription, status: 'trial' });
        return;
      }

      setSubscription({
        status: data.status || 'trial',
        plan: data.plan || null,
        subscriptionEnd: data.subscription_end || null,
        paymentProvider: data.payment_provider || null,
        trialDaysRemaining: data.trial_days_remaining ?? 7,
        trialExpired: data.trial_expired ?? false,
      });
    } catch (err) {
      console.error('Subscription check failed:', err);
      setSubscription({ ...defaultSubscription, status: 'trial' });
    }
  }, [session?.access_token]);

  const refreshSubscription = useCallback(async () => {
    await checkSubscription();
  }, [checkSubscription]);

  useEffect(() => {
    let mounted = true;

    // Set up auth listener FIRST (before getSession)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    init();

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  // Check subscription when session changes
  useEffect(() => {
    if (!loading && session) {
      checkSubscription();
    } else if (!session) {
      setSubscription({ ...defaultSubscription, status: 'trial' });
    }
  }, [session, loading, checkSubscription]);

  // Refresh subscription periodically (every 5 minutes)
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 300000);

    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSubscription({ ...defaultSubscription, status: 'trial' });
  };

  // User has full access if they have active subscription OR are in trial period
  const hasFullAccess = subscription.status === 'active' || 
    (subscription.status === 'trial' && !subscription.trialExpired);

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      loading, 
      subscription, 
      signOut, 
      refreshSubscription,
      hasFullAccess 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
