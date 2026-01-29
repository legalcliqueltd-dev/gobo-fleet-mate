import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Driver App Entry Point
 * 
 * This is the main entry point for the iOS/Android driver app.
 * It checks connection status and redirects accordingly:
 * - Not logged in → Login page
 * - Logged in but not connected → Connect page
 * - Connected → Dashboard
 */
export default function DriverApp() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in - go to login with redirect back to app
      navigate('/app/login', { replace: true });
      return;
    }

    // Check if driver is connected
    checkConnectionStatus();
  }, [user, authLoading]);

  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'get-connection' },
      });

      if (error) {
        console.error('Connection check error:', error);
        navigate('/app/connect', { replace: true });
        return;
      }

      if (data?.connected) {
        // Driver is connected - go to dashboard
        navigate('/app/dashboard', { replace: true });
      } else {
        // Not connected - go to connect page
        navigate('/app/connect', { replace: true });
      }
    } catch (err) {
      console.error('Failed to check connection:', err);
      navigate('/app/connect', { replace: true });
    } finally {
      setChecking(false);
    }
  };

  // Show loading state while checking
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading driver app...</p>
      </div>
    </div>
  );
}
