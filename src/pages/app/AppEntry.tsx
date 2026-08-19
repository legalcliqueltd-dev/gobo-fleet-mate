import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAppRole } from '@/contexts/AppRoleContext';

/**
 * Cold-start router for the native app.
 *
 * First launch has no stored role, so the user lands on the mode picker.
 * After that the app opens straight into whichever side they chose, which
 * keeps the extra screen from becoming a daily toll on drivers.
 */
export default function AppEntry() {
  const { role, ready } = useAppRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;

    if (role === 'admin') navigate('/app/admin', { replace: true });
    else if (role === 'driver') navigate('/app/driver', { replace: true });
    else navigate('/app/role', { replace: true });
  }, [role, ready, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Starting FleetTrackMate…</p>
      </div>
    </div>
  );
}
