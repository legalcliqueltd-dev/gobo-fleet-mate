import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FleetStats = {
  total_distance_km: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  total_idle_minutes: number;
  device_count: number;
  driver_count: number;
  active_count: number;
  idle_count: number;
  offline_count: number;
};

export type UtilizationDay = {
  day: string;
  total_active_minutes: number;
  total_driver_minutes: number;
  utilization_percent: number;
};

export function useFleetAnalytics(days: number = 7) {
  const { user } = useAuth();
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [utilization, setUtilization] = useState<UtilizationDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get admin's connection codes
        const { data: devices } = await supabase
          .from('devices')
          .select('connection_code')
          .eq('user_id', user.id)
          .not('connection_code', 'is', null);

        const codes = devices?.map(d => d.connection_code).filter(Boolean) as string[] || [];

        if (codes.length === 0) {
          setStats({
            total_distance_km: 0, avg_speed_kmh: 0, max_speed_kmh: 0,
            total_idle_minutes: 0, device_count: 0, driver_count: 0, active_count: 0,
            idle_count: 0, offline_count: 0,
          });
          setUtilization([]);
          setLoading(false);
          return;
        }

        const since = new Date();
        since.setDate(since.getDate() - days);

        // Fetch driver-based fleet stats
        const { data: statsData, error: statsError } = await (supabase.rpc as any)('driver_fleet_stats', {
          p_admin_codes: codes,
          p_since: since.toISOString(),
        });

        if (statsError) throw statsError;

        if (statsData && Array.isArray(statsData) && statsData.length > 0) {
          const raw = statsData[0] as any;
          setStats({ ...raw, device_count: raw.driver_count ?? raw.device_count ?? 0 } as FleetStats);
        } else {
          setStats({
            total_distance_km: 0, avg_speed_kmh: 0, max_speed_kmh: 0,
            total_idle_minutes: 0, device_count: 0, driver_count: 0, active_count: 0,
            idle_count: 0, offline_count: 0,
          });
        }

        // Fetch driver-based utilization data
        const { data: utilizationData, error: utilizationError } = await (supabase.rpc as any)(
          'driver_fleet_utilization_daily',
          { p_admin_codes: codes, p_days: days }
        );

        if (utilizationError) throw utilizationError;
        setUtilization((utilizationData || []) as UtilizationDay[]);
      } catch (err: any) {
        console.error('Fleet analytics error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days, user]);

  return { stats, utilization, loading, error };
}
