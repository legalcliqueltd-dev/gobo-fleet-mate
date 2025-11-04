import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type FleetStats = {
  total_distance_km: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  total_idle_minutes: number;
  device_count: number;
  active_count: number;
  idle_count: number;
  offline_count: number;
};

export type UtilizationDay = {
  day: string;
  total_active_minutes: number;
  total_device_minutes: number;
  utilization_percent: number;
};

export function useFleetAnalytics(days: number = 7) {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [utilization, setUtilization] = useState<UtilizationDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const since = new Date();
      since.setDate(since.getDate() - days);

      try {
        // Fetch fleet stats
        const { data: statsData, error: statsError } = await supabase.rpc('fleet_stats', {
          p_since: since.toISOString(),
        });

        if (statsError) throw statsError;

        if (statsData && Array.isArray(statsData) && statsData.length > 0) {
          setStats(statsData[0] as FleetStats);
        } else {
          setStats({
            total_distance_km: 0,
            avg_speed_kmh: 0,
            max_speed_kmh: 0,
            total_idle_minutes: 0,
            device_count: 0,
            active_count: 0,
            idle_count: 0,
            offline_count: 0,
          });
        }

        // Fetch utilization data
        const { data: utilizationData, error: utilizationError } = await supabase.rpc(
          'fleet_utilization_daily',
          { p_days: days }
        );

        if (utilizationError) throw utilizationError;

        setUtilization((utilizationData || []) as UtilizationDay[]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return { stats, utilization, loading, error };
}
