import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type GeofenceEvent = {
  id: string;
  geofence_id: string;
  device_id: string;
  event_type: 'enter' | 'exit';
  latitude: number;
  longitude: number;
  timestamp: string;
  acknowledged: boolean;
};

export type GeofenceEventWithDetails = GeofenceEvent & {
  geofence_name?: string;
  device_name?: string;
};

export function useGeofenceEvents(limit: number = 50) {
  const [events, setEvents] = useState<GeofenceEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('geofence_events')
      .select(`
        *,
        geofences!inner(name),
        devices!inner(name)
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      const eventsWithDetails = (data || []).map((event: any) => ({
        ...event,
        geofence_name: event.geofences?.name,
        device_name: event.devices?.name,
      }));
      setEvents(eventsWithDetails);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('geofence-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'geofence_events',
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const acknowledgeEvent = async (id: string) => {
    const { error } = await supabase
      .from('geofence_events')
      .update({ acknowledged: true })
      .eq('id', id);

    if (error) throw error;
    await fetchEvents();
  };

  const unacknowledgedCount = events.filter((e) => !e.acknowledged).length;

  return {
    events,
    loading,
    error,
    acknowledgeEvent,
    unacknowledgedCount,
    refetch: fetchEvents,
  };
}
