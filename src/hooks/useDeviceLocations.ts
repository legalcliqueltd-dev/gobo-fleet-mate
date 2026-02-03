import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Device = {
  id: string;
  user_id: string;
  name: string | null;
  imei: string | null;
  status: 'active' | 'idle' | 'offline' | null;
  created_at: string;
  is_temporary?: boolean;
  connection_code?: string | null;
};
export type LocationRow = {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: string;
};
export type DeviceWithLatest = Device & { latest: LocationRow | null };

export function useDeviceLocations() {
  const [items, setItems] = useState<DeviceWithLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('devices')
        .select('id, user_id, name, imei, status, created_at, is_temporary, connection_code, locations (id, latitude, longitude, speed, timestamp)')
        .order('timestamp', { foreignTable: 'locations', ascending: false })
        .limit(1, { foreignTable: 'locations' });

      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const mapped: DeviceWithLatest[] = (data ?? []).map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        name: d.name,
        imei: d.imei,
        status: d.status,
        created_at: d.created_at,
        is_temporary: d.is_temporary || false,
        connection_code: d.connection_code || null,
        latest: Array.isArray(d.locations) && d.locations.length > 0 ? d.locations[0] : null,
      }));

      setItems(mapped);
      setLoading(false);
    };

    load();

    // Realtime: locations INSERT updates latest; devices changes trigger reload
    const chLocations = supabase
      .channel('realtime:locations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, (payload) => {
        const row = payload.new as LocationRow;
        setItems((prev) => {
          const idx = prev.findIndex((d) => d.id === row.device_id);
          if (idx === -1) return prev;
          const current = prev[idx].latest;
          const isNewer = !current || new Date(row.timestamp).getTime() >= new Date(current.timestamp).getTime();
          if (!isNewer) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], latest: row };
          return next;
        });
      })
      .subscribe();

    const chDevices = supabase
      .channel('realtime:devices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        load();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(chLocations);
      supabase.removeChannel(chDevices);
    };
  }, []);

  const markers = useMemo(() => {
    return items
      .filter((d) => d.latest)
      .map((d) => ({
        device_id: d.id,
        name: d.name,
        status: d.status,
        latitude: d.latest!.latitude,
        longitude: d.latest!.longitude,
        speed: d.latest!.speed ?? null,
        timestamp: d.latest!.timestamp,
        is_temporary: d.is_temporary || false,
      }));
  }, [items]);

  return { items, markers, loading, error };
}
