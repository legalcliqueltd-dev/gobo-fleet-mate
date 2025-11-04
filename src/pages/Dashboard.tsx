import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Device, MarkerData } from '../types';
import { useRealtimeLocations } from '../hooks/useRealtimeLocations';
import DeviceSidebar from '../components/dashboard/DeviceSidebar';
import MapView from '../components/map/MapView';

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('Failed to load devices:', error.message);
        setDevices([]);
      } else {
        setDevices(data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const latest = useRealtimeLocations(devices.map((d) => d.id));

  const markers: MarkerData[] = useMemo(() => {
    return devices
      .map((d) => {
        const l = latest[d.id];
        if (!l) return null;
        const ageMin = (Date.now() - new Date(l.timestamp).getTime()) / 60000;
        const status = ageMin <= 2 ? 'active' : ageMin <= 10 ? 'idle' : 'offline';
        return {
          id: d.id,
          latitude: l.latitude,
          longitude: l.longitude,
          label: d.name || d.imei || 'Device',
          speed: l.speed ?? null,
          timestamp: l.timestamp,
          status,
        } as MarkerData;
      })
      .filter(Boolean) as MarkerData[];
  }, [devices, latest]);

  return (
    <div className="grid gap-6 md:grid-cols-[auto,1fr]">
      <DeviceSidebar devices={devices} latest={latest} onSelect={setSelected} selectedId={selected} />
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Realtime Map</h2>
        {loading ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-6 text-sm text-slate-600">
            Loading devices…
          </div>
        ) : (
          <MapView markers={markers} mapStyle={mapStyle} onMapStyleChange={setMapStyle} />
        )}
      </div>
    </div>
  );
}
