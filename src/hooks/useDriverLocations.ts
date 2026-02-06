import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type DriverLocation = {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  status: string | null;
  last_seen_at: string | null;
  connected_at: string | null;
  updated_at: string | null; // Location last updated timestamp
};

export function useDriverLocations() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminCodes, setAdminCodes] = useState<Set<string>>(new Set());

  const fetchDriverLocations = useCallback(async (silent = false) => {
    if (!user) return;
    
    // Only show loading on initial fetch, not on refreshes
    if (!silent) setLoading(true);
    
    try {
      // Get admin codes from connections and devices
      const [connectionsRes, devicesRes] = await Promise.all([
        supabase
          .from('driver_connections')
          .select('connection_code')
          .eq('admin_user_id', user.id)
          .not('connection_code', 'is', null),
        supabase
          .from('devices')
          .select('connection_code')
          .eq('user_id', user.id)
          .not('connection_code', 'is', null)
      ]);

      const codes = new Set<string>();
      connectionsRes.data?.forEach(c => c.connection_code && codes.add(c.connection_code));
      devicesRes.data?.forEach(d => d.connection_code && codes.add(d.connection_code));
      setAdminCodes(codes);

      if (codes.size === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      // Fetch drivers and their locations in parallel
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .in('admin_code', Array.from(codes));

      if (driversError) throw driversError;
      if (!driversData || driversData.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      const driverIds = driversData.map(d => d.driver_id);
      const { data: locationsData } = await supabase
        .from('driver_locations')
        .select('*')
        .in('driver_id', driverIds);

      // Merge drivers with their locations (don't filter out drivers without location)
      const merged: DriverLocation[] = driversData.map(driver => {
        const location = locationsData?.find(l => l.driver_id === driver.driver_id);
        return {
          driver_id: driver.driver_id,
          driver_name: driver.driver_name,
          admin_code: driver.admin_code,
          latitude: location?.latitude ?? 0,
          longitude: location?.longitude ?? 0,
          speed: location?.speed ?? null,
          accuracy: location?.accuracy ?? null,
          status: driver.status,
          last_seen_at: driver.last_seen_at,
          connected_at: driver.connected_at,
          updated_at: location?.updated_at ?? null,
        };
      });

      setDrivers(merged);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching driver locations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    fetchDriverLocations(false); // Initial fetch with loading

    // Real-time subscriptions for instant updates (silent)
    const locationsChannel = supabase
      .channel('realtime-driver-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        () => fetchDriverLocations(true)
      )
      .subscribe();

    const driversChannel = supabase
      .channel('realtime-drivers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => fetchDriverLocations(true)
      )
      .subscribe();

    // Fallback polling every 15 seconds (silent)
    const interval = setInterval(() => fetchDriverLocations(true), 15000);

    return () => {
      supabase.removeChannel(locationsChannel);
      supabase.removeChannel(driversChannel);
      clearInterval(interval);
    };
  }, [user, fetchDriverLocations]);

  return { drivers, loading, error, refetch: fetchDriverLocations };
}
