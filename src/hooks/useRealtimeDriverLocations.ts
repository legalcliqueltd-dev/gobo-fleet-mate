import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LiveDriverLocation {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  latitude: number;
  longitude: number;
  previousLatitude?: number;
  previousLongitude?: number;
  speed: number | null;
  accuracy: number | null;
  status: 'active' | 'idle' | 'offline' | 'stale';
  last_seen_at: string | null;
  updated_at: string | null;
  isAnimating?: boolean;
}

// Time thresholds for status
const ACTIVE_THRESHOLD = 2 * 60 * 1000;  // 2 min = active
const IDLE_THRESHOLD = 5 * 60 * 1000;    // 5 min = idle
const STALE_THRESHOLD = 15 * 1000;       // 15 sec without update = stale

export function useRealtimeDriverLocations() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<LiveDriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Keep track of previous positions for animation
  const previousPositions = useRef<Map<string, { lat: number; lng: number; timestamp: number }>>(new Map());

  // Calculate driver status based on last seen time
  const calculateStatus = useCallback((lastSeenAt: string | null, speed: number | null): LiveDriverLocation['status'] => {
    if (!lastSeenAt) return 'offline';
    
    const timeSinceUpdate = Date.now() - new Date(lastSeenAt).getTime();
    
    if (timeSinceUpdate > IDLE_THRESHOLD) return 'offline';
    if (timeSinceUpdate > ACTIVE_THRESHOLD) return 'idle';
    if (speed && speed > 5) return 'active';
    return 'active';
  }, []);

  // Fetch initial data
  const fetchDriverLocations = useCallback(async () => {
    if (!user) {
      console.log('🚫 No user, skipping driver fetch');
      return;
    }

    try {
      console.log('🔄 Fetching driver locations...');
      
      // Fetch drivers linked to this admin
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*');

      if (driversError) throw driversError;
      console.log('👥 Drivers fetched:', driversData?.length, driversData);

      // Fetch latest locations for all drivers
      const { data: locationsData, error: locationsError } = await supabase
        .from('driver_locations')
        .select('*');

      if (locationsError) throw locationsError;
      console.log('📍 Locations fetched:', locationsData?.length, locationsData);

      // Merge data
      const mergedDrivers: LiveDriverLocation[] = (driversData || []).map(driver => {
        const location = locationsData?.find(l => l.driver_id === driver.driver_id);
        console.log(`🔗 Driver ${driver.driver_name}: location =`, location);
        const prevPos = previousPositions.current.get(driver.driver_id);
        
        return {
          driver_id: driver.driver_id,
          driver_name: driver.driver_name,
          admin_code: driver.admin_code,
          latitude: location?.latitude ?? 0,
          longitude: location?.longitude ?? 0,
          previousLatitude: prevPos?.lat,
          previousLongitude: prevPos?.lng,
          speed: location?.speed ?? null,
          accuracy: location?.accuracy ?? null,
          status: calculateStatus(driver.last_seen_at, location?.speed ?? null),
          last_seen_at: driver.last_seen_at,
          updated_at: location?.updated_at ?? null,
        };
      });

      console.log('✅ Merged drivers:', mergedDrivers.map(d => ({
        name: d.driver_name,
        lat: d.latitude,
        lng: d.longitude,
        status: d.status
      })));

      // Update previous positions
      mergedDrivers.forEach(d => {
        if (d.latitude !== 0 && d.longitude !== 0) {
          previousPositions.current.set(d.driver_id, {
            lat: d.latitude,
            lng: d.longitude,
            timestamp: Date.now()
          });
        }
      });

      const validCount = mergedDrivers.filter(d => d.latitude !== 0 && d.longitude !== 0).length;
      console.log(`📊 Valid drivers with location: ${validCount}/${mergedDrivers.length}`);

      setDrivers(mergedDrivers);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching driver locations:', err);
      setError('Failed to load driver locations');
      setLoading(false);
    }
  }, [user, calculateStatus]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    fetchDriverLocations();

    // Subscribe to driver_locations changes
    const locationsChannel = supabase
      .channel('live-driver-locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations'
        },
        (payload) => {
          console.log('📍 Location update:', payload);
          setLastUpdate(new Date());
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newLocation = payload.new as any;
            
            setDrivers(prev => {
              return prev.map(driver => {
                if (driver.driver_id === newLocation.driver_id) {
                  // Store previous position for interpolation
                  const prevPos = previousPositions.current.get(driver.driver_id);
                  previousPositions.current.set(driver.driver_id, {
                    lat: newLocation.latitude,
                    lng: newLocation.longitude,
                    timestamp: Date.now()
                  });

                  return {
                    ...driver,
                    previousLatitude: prevPos?.lat ?? driver.latitude,
                    previousLongitude: prevPos?.lng ?? driver.longitude,
                    latitude: newLocation.latitude,
                    longitude: newLocation.longitude,
                    speed: newLocation.speed,
                    accuracy: newLocation.accuracy,
                    updated_at: newLocation.updated_at,
                    status: calculateStatus(newLocation.updated_at, newLocation.speed),
                    isAnimating: true,
                  };
                }
                return driver;
              });
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers'
        },
        (payload) => {
          console.log('👤 Driver update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newDriver = payload.new as any;
            setDrivers(prev => {
              if (prev.find(d => d.driver_id === newDriver.driver_id)) return prev;
              return [...prev, {
                driver_id: newDriver.driver_id,
                driver_name: newDriver.driver_name,
                admin_code: newDriver.admin_code,
                latitude: 0,
                longitude: 0,
                speed: null,
                accuracy: null,
                status: calculateStatus(newDriver.last_seen_at, null),
                last_seen_at: newDriver.last_seen_at,
                updated_at: null,
              }];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedDriver = payload.new as any;
            setDrivers(prev => prev.map(d => {
              if (d.driver_id === updatedDriver.driver_id) {
                return {
                  ...d,
                  driver_name: updatedDriver.driver_name,
                  status: calculateStatus(updatedDriver.last_seen_at, d.speed),
                  last_seen_at: updatedDriver.last_seen_at,
                };
              }
              return d;
            }));
          } else if (payload.eventType === 'DELETE') {
            const deletedDriver = payload.old as any;
            setDrivers(prev => prev.filter(d => d.driver_id !== deletedDriver.driver_id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    // Periodically refresh status (check for stale)
    const statusInterval = setInterval(() => {
      setDrivers(prev => prev.map(d => ({
        ...d,
        status: calculateStatus(d.last_seen_at, d.speed),
        isAnimating: false, // Reset animation flag after interval
      })));
    }, 10000); // Check every 10 seconds

    return () => {
      supabase.removeChannel(locationsChannel);
      clearInterval(statusInterval);
    };
  }, [user, fetchDriverLocations, calculateStatus]);

  return {
    drivers,
    loading,
    error,
    lastUpdate,
    connectionStatus,
    refetch: fetchDriverLocations,
  };
}
