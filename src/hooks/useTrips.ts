import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Trip = {
  id: string;
  device_id: string;
  start_time: string;
  end_time: string | null;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number | null;
  end_longitude: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  status: 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
};

export type TripWithDevice = Trip & {
  device_name?: string;
};

export function useTrips(deviceId?: string, limit: number = 50) {
  const [trips, setTrips] = useState<TripWithDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('trips')
      .select(`
        *,
        devices!inner(name)
      `)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      const tripsWithDevice = (data || []).map((trip: any) => ({
        ...trip,
        device_name: trip.devices?.name,
      }));
      setTrips(tripsWithDevice);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();

    // Subscribe to real-time trip updates
    const channel = supabase
      .channel('trips-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: deviceId ? `device_id=eq.${deviceId}` : undefined,
        },
        () => {
          fetchTrips();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, limit]);

  return {
    trips,
    loading,
    error,
    refetch: fetchTrips,
  };
}
