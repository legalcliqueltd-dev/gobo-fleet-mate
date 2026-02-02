import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { Loader2 } from 'lucide-react';

/**
 * Driver App Entry Point
 * 
 * This is the main entry point for the iOS/Android driver app.
 * It checks connection status and redirects accordingly:
 * - Not connected → Connect page (name + code)
 * - Connected → Dashboard
 * 
 * No email/password login required - just name and admin code.
 */
export default function DriverApp() {
  const { isConnected, loading } = useDriverSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (isConnected) {
      navigate('/app/dashboard', { replace: true });
    } else {
      navigate('/app/connect', { replace: true });
    }
  }, [isConnected, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading driver app...</p>
      </div>
    </div>
  );
}
