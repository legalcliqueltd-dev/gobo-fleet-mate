import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SOSEventWithDriver {
  id: string;
  user_id: string | null; // auth user UUID (nullable for code-based drivers)
  driver_id?: string | null; // code-based driver id
  device_id: string | null;
  hazard: string;
  message: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolved_note: string | null;
  status: string;
  admin_code?: string | null;
  driver_name?: string;
  driver_phone?: string;
}

interface UseSOSNotificationsReturn {
  openSOSCount: number;
  recentSOS: SOSEventWithDriver[];
  isAdmin: boolean;
  refreshSOS: () => Promise<void>;
  markAsRead: (sosId: string) => void;
  unreadIds: Set<string>;
}

const isUuid = (value: string | null | undefined) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// Audio alert for new SOS
const playSOSAlert = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc2.start();
      osc2.stop(audioContext.currentTime + 0.5);
    }, 200);
  } catch {
    // ignore
  }
};

export function useSOSNotifications(): UseSOSNotificationsReturn {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentSOS, setRecentSOS] = useState<SOSEventWithDriver[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  const hasFetchedOnceRef = useRef(false);
  const previousOpenIdsRef = useRef<Set<string>>(new Set());

  const checkAdmin = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    setIsAdmin(!!data);
  }, [user]);

  const fetchSOSEvents = useCallback(async () => {
    if (!user) return;

    // Get the admin's connection codes (devices they own)
    const { data: adminDevices } = await supabase
      .from('devices')
      .select('connection_code')
      .eq('user_id', user.id);

    const adminCodes = adminDevices?.map((d) => d.connection_code).filter(Boolean) || [];

    let query = supabase
      .from('sos_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Only show SOS events from their drivers (if they have device codes)
    if (adminCodes.length > 0) {
      query = query.in('admin_code', adminCodes as string[]);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching SOS events:', error);
      return;
    }

    if (!events) return;

    // Enrich with driver names - first try drivers table (code-based), then profiles (auth-based)
    const enrichedEvents: SOSEventWithDriver[] = await Promise.all(
      events.map(async (event: any) => {
        const driverLookupId: string | null = event.driver_id || event.user_id || null;

        if (driverLookupId) {
          const { data: driver } = await supabase
            .from('drivers')
            .select('driver_id, driver_name, admin_code')
            .eq('driver_id', driverLookupId)
            .single();

          if (driver) {
            return {
              ...event,
              driver_name: driver.driver_name || driver.driver_id || 'Unknown Driver',
              driver_phone: driver.admin_code,
            } as SOSEventWithDriver;
          }
        }

        if (isUuid(event.user_id)) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', event.user_id)
            .single();

          return {
            ...event,
            driver_name: profile?.full_name || profile?.email || 'Unknown Driver',
          } as SOSEventWithDriver;
        }

        return {
          ...event,
          driver_name: 'Unknown Driver',
        } as SOSEventWithDriver;
      })
    );

    // Detect newly opened SOS (avoid firing on first load)
    const currentOpen = enrichedEvents.filter((e) => e.status === 'open');
    const currentOpenIds = new Set(currentOpen.map((e) => e.id));

    if (hasFetchedOnceRef.current) {
      const newlyOpened = currentOpen.filter((e) => !previousOpenIdsRef.current.has(e.id));

      if (newlyOpened.length > 0) {
        playSOSAlert();

        // list is already ordered desc by created_at, so the first newly-opened is typically the newest
        const newest = newlyOpened[0];
        toast.error(`New SOS Alert: ${String(newest.hazard || 'SOS').toUpperCase()} from ${newest.driver_name}`,
          {
            duration: 10000,
            action: {
              label: 'View',
              onClick: () => (window.location.href = '/ops/incidents'),
            },
          }
        );
        setUnreadIds((prev) => new Set(prev).add(newest.id));
      }
    }

    previousOpenIdsRef.current = currentOpenIds;
    hasFetchedOnceRef.current = true;

    setRecentSOS(enrichedEvents);
  }, [user]);

  const markAsRead = useCallback((sosId: string) => {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(sosId);
      return next;
    });
  }, []);

  useEffect(() => {
    checkAdmin();
    fetchSOSEvents();

    const channel = supabase
      .channel('sos-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_events',
        },
        () => {
          fetchSOSEvents();
        }
      )
      .subscribe();

    const interval = setInterval(fetchSOSEvents, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [checkAdmin, fetchSOSEvents]);

  const openSOSCount = recentSOS.filter((e) => e.status === 'open' || e.status === 'acknowledged').length;

  return {
    openSOSCount,
    recentSOS,
    isAdmin,
    refreshSOS: fetchSOSEvents,
    markAsRead,
    unreadIds,
  };
}
