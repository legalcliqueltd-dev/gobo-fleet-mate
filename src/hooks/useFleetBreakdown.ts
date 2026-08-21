import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { getVehicleStatus, type VehicleStatus } from '@/lib/driverStatus';

export type DriverBreakdown = {
  driverId: string;
  name: string;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  idleMinutes: number;
  activeMinutes: number;
  points: number;
  status: VehicleStatus;
};

export type FleetTotals = {
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  idleMinutes: number;
  activeMinutes: number;
  driverCount: number;
  reportingCount: number;
  moving: number;
  idle: number;
  offline: number;
};

/**
 * Per-driver insights, with the fleet totals derived from them.
 *
 * Deliberately built on the `driver_stats` RPC (the noise-hardened v2: it
 * discards fixes worse than 100 m, treats sub-15 m wander while stationary as
 * zero distance, and ignores implied speeds above 180 km/h as GPS teleports)
 * rather than a separate fleet-level aggregate.
 *
 * Two reasons. The headline tiles and the per-driver list can never disagree,
 * because one is the sum of the other. And when a number looks wrong, it is
 * attributable — you can see which driver contributed it instead of staring at
 * a fleet total with no way in.
 */
export function useFleetBreakdown(days: number) {
  const { codes, loading: codesLoading } = useAdminCodes();

  const [drivers, setDrivers] = useState<DriverBreakdown[]>([]);
  const [totals, setTotals] = useState<FleetTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setDrivers([]);
      setTotals(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: driverRows, error: driversError }, { data: locationRows }] = await Promise.all([
        supabase
          .from('drivers')
          .select('driver_id, driver_name, last_seen_at')
          .in('admin_code', codes),
        supabase.from('driver_locations').select('driver_id, speed, updated_at').in('admin_code', codes),
      ]);

      if (driversError) throw driversError;

      const locationByDriver = new Map(
        (locationRows ?? []).map((row) => [row.driver_id, row])
      );

      const rows = await Promise.all(
        (driverRows ?? []).map(async (driver): Promise<DriverBreakdown> => {
          const { data } = await (supabase.rpc as any)('driver_stats', {
            p_driver_id: driver.driver_id,
            p_since: since,
          });

          const stats = Array.isArray(data) && data.length > 0 ? data[0] : null;
          const live = locationByDriver.get(driver.driver_id);

          return {
            driverId: driver.driver_id,
            name: driver.driver_name?.trim() || 'Unnamed driver',
            distanceKm: Number(stats?.distance_km ?? 0),
            avgSpeedKmh: Number(stats?.avg_speed_kmh ?? 0),
            maxSpeedKmh: Number(stats?.max_speed_kmh ?? 0),
            idleMinutes: Number(stats?.idle_minutes ?? 0),
            activeMinutes: Number(stats?.active_minutes ?? 0),
            points: Number(stats?.total_points ?? 0),
            status: getVehicleStatus(live?.speed ?? 0, live?.updated_at ?? driver.last_seen_at),
          };
        })
      );

      // Busiest first — the drivers worth looking at lead the list.
      rows.sort((a, b) => b.distanceKm - a.distanceKm);
      setDrivers(rows);

      const reporting = rows.filter((r) => r.points > 0);
      setTotals({
        distanceKm: rows.reduce((sum, r) => sum + r.distanceKm, 0),
        // Averaged over drivers that actually reported, so parked vehicles do
        // not drag the fleet average toward zero.
        avgSpeedKmh: reporting.length
          ? reporting.reduce((sum, r) => sum + r.avgSpeedKmh, 0) / reporting.length
          : 0,
        maxSpeedKmh: rows.reduce((max, r) => Math.max(max, r.maxSpeedKmh), 0),
        idleMinutes: rows.reduce((sum, r) => sum + r.idleMinutes, 0),
        activeMinutes: rows.reduce((sum, r) => sum + r.activeMinutes, 0),
        driverCount: rows.length,
        reportingCount: reporting.length,
        moving: rows.filter((r) => r.status === 'moving').length,
        idle: rows.filter((r) => r.status === 'idle').length,
        offline: rows.filter((r) => r.status === 'offline').length,
      });
    } catch (err) {
      console.error('[useFleetBreakdown] failed:', err);
      setError(err instanceof Error ? err.message : 'Could not load insights.');
    } finally {
      setLoading(false);
    }
  }, [codes, days]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  return { drivers, totals, loading, error, refetch: load };
}
