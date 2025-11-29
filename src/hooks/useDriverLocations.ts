import { useEffect, useState } from 'react';
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
};

export function useDriverLocations() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchDriverLocations = async () => {
      try {
        // Get driver_connections for this admin to find their admin_code
        const { data: connections } = await supabase
          .from('driver_connections')
          .select('connection_code')
          .eq('admin_user_id', user.id)
          .not('connection_code', 'is', null)
          .limit(1);

        // Also check devices for connection codes
        const { data: devices } = await supabase
          .from('devices')
          .select('connection_code')
          .eq('user_id', user.id)
          .not('connection_code', 'is', null);

        const adminCodes = new Set<string>();
        
        connections?.forEach(c => {
          if (c.connection_code) adminCodes.add(c.connection_code);
        });
        
        devices?.forEach(d => {
          if (d.connection_code) adminCodes.add(d.connection_code);
        });

        if (adminCodes.size === 0) {
          setDrivers([]);
          setLoading(false);
          return;
        }

        // Fetch drivers connected with any of these admin codes
        const { data: driversData, error: driversError } = await supabase
          .from('drivers')
          .select('*')
          .in('admin_code', Array.from(adminCodes));

        if (driversError) throw driversError;

        if (!driversData || driversData.length === 0) {
          setDrivers([]);
          setLoading(false);
          return;
        }

        // Fetch latest location for each driver
        const driverIds = driversData.map(d => d.driver_id);
        const { data: locationsData, error: locationsError } = await supabase
          .from('driver_locations')
          .select('*')
          .in('driver_id', driverIds);

        if (locationsError) throw locationsError;

        // Merge driver info with latest location
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
          };
        }).filter(d => d.latitude !== 0 && d.longitude !== 0);

        setDrivers(merged);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching driver locations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverLocations();

    // Set up realtime subscription for driver_locations
    const channel = supabase
      .channel('driver-locations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        () => {
          fetchDriverLocations();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => {
          fetchDriverLocations();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchDriverLocations, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  return { drivers, loading, error };
}
