import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InsightRange = '24h' | '7d';
export type DeviceStats = {
  distance_km: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  idle_minutes: number;
};

export function useDeviceInsights(deviceId: string | undefined, range: InsightRange) {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!deviceId) return;
      setLoading(true);
      setError(null);
      const since = new Date();
      since.setDate(since.getDate() - (range === '24h' ? 1 : 7));

      const { data, error } = await supabase.rpc('device_stats', {
        p_device_id: deviceId,
        p_since: since.toISOString(),
      });

      if (error) {
        setError(error.message);
        setStats(null);
      } else if (data && Array.isArray(data) && data.length > 0) {
        // Supabase returns an array of rows for table-returning functions
        setStats(data[0] as DeviceStats);
      } else {
        setStats({ distance_km: 0, avg_speed_kmh: 0, max_speed_kmh: 0, idle_minutes: 0 });
      }
      setLoading(false);
    };
    run();
  }, [deviceId, range]);

  return { stats, loading, error };
}
