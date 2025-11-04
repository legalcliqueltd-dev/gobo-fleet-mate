import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Location } from '../types';

export function useRealtimeLocations(deviceIds: string[]) {
  const [latest, setLatest] = useState<Record<string, Location | undefined>>({});

  useEffect(() => {
    let mounted = true;

    const fetchInitial = async () => {
      if (deviceIds.length === 0) {
        setLatest({});
        return;
      }
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .in('device_id', deviceIds)
        .order('timestamp', { ascending: false });
      if (error) {
        console.warn('Failed to fetch locations:', error.message);
        return;
      }
      if (!mounted) return;
      const byDevice: Record<string, Location> = {};
      for (const row of data) {
        if (!byDevice[row.device_id]) byDevice[row.device_id] = row;
      }
      setLatest(byDevice);
    };

    fetchInitial();

    // Subscribe to realtime changes (INSERT and UPDATE)
    const channel = supabase
      .channel('realtime:locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          const row = (payload.new || payload.old) as Location;
          if (!row || !deviceIds.includes(row.device_id)) return;
          setLatest((prev) => ({ ...prev, [row.device_id]: row }));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [JSON.stringify(deviceIds)]);

  return latest;
}
