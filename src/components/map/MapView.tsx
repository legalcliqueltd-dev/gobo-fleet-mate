import { useMemo, useRef, useState } from 'react';
import Map, { MapRef, NavigationControl, GeolocateControl } from 'react-map-gl';
import DeviceMarker from './DeviceMarker';
import Button from '../ui/Button';
import { Layers, Scan } from 'lucide-react';
import { MAPBOX_TOKEN } from '../../lib/mapboxConfig';

type MarkerItem = {
  device_id: string;
  name: string | null;
  status: 'active' | 'idle' | 'offline' | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  timestamp: string | null;
  is_temporary?: boolean;
};
type Props = {
  items: MarkerItem[];
  onMarkerClick?: (deviceId: string) => void;
};

const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

export default function MapView({ items, onMarkerClick }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [styleId, setStyleId] = useState<keyof typeof STYLES>('streets');

  const initial = useMemo(() => {
    if (items.length === 0) return { longitude: 0, latitude: 20, zoom: 1.5 };
    const [lon, lat] = [items[0].longitude, items[0].latitude];
    return { longitude: lon, latitude: lat, zoom: 10 };
  }, [items]);

  const fitToAll = () => {
    if (!mapRef.current || items.length === 0) return;
    const lats = items.map(i => i.latitude);
    const lons = items.map(i => i.longitude);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 800 });
  };

  const flyTo = (lon: number, lat: number) => {
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 14, duration: 900 });
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-shell rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur flex items-center justify-center">
        <div className="text-sm text-slate-600 dark:text-slate-300">Set VITE_MAPBOX_TOKEN to see the map.</div>
      </div>
    );
  }

  return (
    <div className="relative map-shell rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 glass-card">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initial}
        mapStyle={STYLES[styleId]}
        style={{ width: '100%', height: '100%' }}
      >
        <div className="absolute top-2 left-2 z-10 flex gap-2">
          <Button variant="outline" size="sm" onClick={fitToAll} className="bg-white/90 dark:bg-slate-900/80">
            <Scan className="h-4 w-4 mr-1" /> Fit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStyleId(styleId === 'streets' ? 'satellite' : 'streets')}
            className="bg-white/90 dark:bg-slate-900/80"
          >
            <Layers className="h-4 w-4 mr-1" />
            {styleId === 'streets' ? 'Satellite' : 'Streets'}
          </Button>
        </div>

        <NavigationControl position="bottom-right" />
        <GeolocateControl position="bottom-right" />

        {items.map(i => (
          <DeviceMarker
            key={i.device_id}
            latitude={i.latitude}
            longitude={i.longitude}
            name={i.is_temporary ? `👤 ${i.name}` : i.name}
            speed={i.speed ?? null}
            status={i.status}
            onClick={() => {
              flyTo(i.longitude, i.latitude);
              onMarkerClick?.(i.device_id);
            }}
          />
        ))}
      </Map>
    </div>
  );
}
