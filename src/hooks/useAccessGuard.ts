import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { trackingService } from '@/services/trackingService';

/** How often to confirm the driver still has access. */
const CHECK_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Enforces revocation on the driver's phone.
 *
 * Revoking is only half a control if the other device never finds out: the
 * manager sees "locked out" while the driver keeps transmitting, which is
 * worse than not having the button at all because it is quietly untrue.
 *
 * So the app confirms periodically that its own driver row is still active and
 * still matches the code it holds. If the row was revoked, deleted, or the
 * code was rotated to a new value, tracking stops immediately, the local
 * session is cleared, and the driver is returned to the join screen with an
 * explanation rather than a silent failure.
 *
 * Checks run on an interval and whenever the app returns to the foreground —
 * the moment a phone comes out of a pocket is exactly when a stale session is
 * most likely.
 */
export function useAccessGuard() {
  const { session, disconnect } = useDriverSession();
  const navigate = useNavigate();
  const lockedOut = useRef(false);

  useEffect(() => {
    if (!session?.driverId || !session?.adminCode) return;

    let cancelled = false;

    const lockOut = async (reason: string) => {
      if (lockedOut.current || cancelled) return;
      lockedOut.current = true;

      await trackingService.stop().catch(() => {});
      disconnect();
      toast.error('Access removed', { description: reason, duration: 8000 });
      navigate('/app/connect', { replace: true });
    };

    const check = async () => {
      if (cancelled || lockedOut.current) return;
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('status, admin_code')
          .eq('driver_id', session.driverId)
          .maybeSingle();

        // A network blip must never log anyone out — only a definite answer does.
        if (error) return;

        if (!data) {
          await lockOut('Your driver profile was removed. Ask your manager for a new code.');
          return;
        }
        if (data.status === 'revoked') {
          await lockOut('Your manager removed your access. Ask them for a new code.');
          return;
        }
        if (data.admin_code !== session.adminCode) {
          await lockOut('Your fleet code changed. Ask your manager for the new one.');
        }
      } catch {
        /* offline — try again next tick */
      }
    };

    void check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session?.driverId, session?.adminCode, disconnect, navigate]);
}
