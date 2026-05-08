import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const POLL_INTERVAL_MS = 60_000;

export interface EmergencyContact {
  name: string;
  phone: string;
}

/**
 * Driver-side hook. Resolves the admin-configured emergency contact for the
 * connected fleet by polling the `connect-driver` edge function (the same
 * pattern as `useTaskNotifications` — direct Supabase queries are blocked by
 * RLS for anonymous drivers).
 *
 * Refreshes on mount, every 60 s, and whenever the tab/app returns to the
 * foreground, so admin changes propagate within a heartbeat.
 *
 * Returns `contact: null` when the admin has not set one — the SOS screen
 * uses this to render a disabled "not set" state instead of a tappable
 * `tel:` link.
 */
export function useEmergencyContact(driverId: string | undefined, adminCode: string | undefined) {
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!driverId || !adminCode) {
      setContact(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchContact = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { data, error } = await supabase.functions.invoke('connect-driver', {
          body: { action: 'get-emergency-contact', driverId, adminCode },
        });
        if (cancelled) return;
        if (error) {
          console.warn('[useEmergencyContact] edge fn error:', error);
          return;
        }
        const next = (data?.contact as EmergencyContact | null | undefined) ?? null;
        setContact((prev) => {
          if (prev?.phone === next?.phone && prev?.name === next?.name) return prev;
          return next;
        });
      } catch (err) {
        if (!cancelled) console.warn('[useEmergencyContact] fetch failed:', err);
      } finally {
        inFlight.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    fetchContact();
    const interval = window.setInterval(fetchContact, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchContact();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [driverId, adminCode]);

  return { contact, loading };
}
