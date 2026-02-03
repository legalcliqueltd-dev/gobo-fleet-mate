import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DriverInsights {
  distance_km: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  idle_minutes: number;
  active_minutes: number;
  total_points: number;
}

export function useDriverInsights(driverId: string | undefined, since: Date) {
  return useQuery({
    queryKey: ['driver-insights', driverId, since.toISOString()],
    queryFn: async (): Promise<DriverInsights | null> => {
      if (!driverId) return null;

      const { data, error } = await supabase
        .rpc('driver_stats', {
          p_driver_id: driverId,
          p_since: since.toISOString(),
        });

      if (error) {
        console.error('Error fetching driver insights:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          distance_km: 0,
          avg_speed_kmh: 0,
          max_speed_kmh: 0,
          idle_minutes: 0,
          active_minutes: 0,
          total_points: 0,
        };
      }

      return data[0] as DriverInsights;
    },
    enabled: !!driverId,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });
}

// Helper to calculate time ranges
export function getTimeRange(range: string): Date {
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '4h':
      return new Date(now.getTime() - 4 * 60 * 60 * 1000);
    case '12h':
      return new Date(now.getTime() - 12 * 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '3d':
      return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}
