import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SOSEventWithDriver {
  id: string;
  user_id: string;
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

// Audio alert for new SOS
const playSOSAlert = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Play a second beep
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
  } catch (error) {
    console.log('Audio alert not supported');
  }
};

export function useSOSNotifications(): UseSOSNotificationsReturn {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentSOS, setRecentSOS] = useState<SOSEventWithDriver[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const previousOpenCountRef = useRef<number>(0);

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

    const { data: events, error } = await supabase
      .from('sos_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching SOS events:', error);
      return;
    }

    if (events) {
      // Enrich with driver names from profiles
      const enrichedEvents: SOSEventWithDriver[] = await Promise.all(
        events.map(async (event) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', event.user_id)
            .single();

          return {
            ...event,
            driver_name: profile?.full_name || profile?.email || 'Unknown Driver',
          };
        })
      );

      // Check for new open SOS events
      const currentOpenCount = enrichedEvents.filter(e => e.status === 'open').length;
      const newOpenEvents = enrichedEvents.filter(
        e => e.status === 'open' && !previousOpenCountRef.current
      );

      if (currentOpenCount > previousOpenCountRef.current && previousOpenCountRef.current > 0) {
        // New SOS received!
        playSOSAlert();
        const newest = enrichedEvents.find(e => e.status === 'open');
        if (newest) {
          toast.error(
            `🚨 New SOS Alert: ${newest.hazard.toUpperCase()} from ${newest.driver_name}`,
            {
              duration: 10000,
              action: {
                label: 'View',
                onClick: () => window.location.href = '/ops/incidents',
              },
            }
          );
          setUnreadIds(prev => new Set(prev).add(newest.id));
        }
      }

      previousOpenCountRef.current = currentOpenCount;
      setRecentSOS(enrichedEvents);
    }
  }, [user]);

  const markAsRead = useCallback((sosId: string) => {
    setUnreadIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(sosId);
      return newSet;
    });
  }, []);

  useEffect(() => {
    checkAdmin();
    fetchSOSEvents();

    // Subscribe to real-time updates
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

    // Refresh every 30 seconds
    const interval = setInterval(fetchSOSEvents, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [checkAdmin, fetchSOSEvents]);

  const openSOSCount = recentSOS.filter(e => e.status === 'open' || e.status === 'acknowledged').length;

  return {
    openSOSCount,
    recentSOS,
    isAdmin,
    refreshSOS: fetchSOSEvents,
    markAsRead,
    unreadIds,
  };
}
