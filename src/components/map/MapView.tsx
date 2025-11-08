import { useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import DeviceMarker from './DeviceMarker';
import Button from '../ui/Button';
import { Layers, Scan } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';

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

const MAP_STYLES = {
  roadmap: 'roadmap',
  satellite: 'hybrid',
};

export default function MapView({ items, onMarkerClick }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<keyof typeof MAP_STYLES>('roadmap');
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const initial = useMemo(() => {
    if (items.length === 0) return { longitude: 0, latitude: 20, zoom: 1.5 };
    const [lon, lat] = [items[0].longitude, items[0].latitude];
    return { longitude: lon, latitude: lat, zoom: 10 };
  }, [items]);

  const fitToAll = () => {
    if (!mapRef.current || items.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    items.forEach(i => bounds.extend({ lat: i.latitude, lng: i.longitude }));
    mapRef.current.fitBounds(bounds, 60);
  };

  const flyTo = (lat: number, lng: number) => {
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(14);
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map-shell rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur flex items-center justify-center">
        <div className="text-sm text-slate-600 dark:text-slate-300">Set VITE_GOOGLE_MAPS_API_KEY to see the map.</div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="map-shell rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur flex items-center justify-center">
        <div className="text-sm text-slate-600 dark:text-slate-300">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative map-shell rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 glass-card">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: initial.latitude, lng: initial.longitude }}
        zoom={initial.zoom}
        mapTypeId={MAP_STYLES[mapType]}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        <div className="absolute top-2 left-2 z-10 flex gap-2">
          <Button variant="outline" size="sm" onClick={fitToAll} className="bg-white/90 dark:bg-slate-900/80">
            <Scan className="h-4 w-4 mr-1" /> Fit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
            className="bg-white/90 dark:bg-slate-900/80"
          >
            <Layers className="h-4 w-4 mr-1" />
            {mapType === 'roadmap' ? 'Satellite' : 'Roadmap'}
          </Button>
        </div>

        {items.map(i => (
          <DeviceMarker
            key={i.device_id}
            latitude={i.latitude}
            longitude={i.longitude}
            name={i.is_temporary ? `👤 ${i.name}` : i.name}
            speed={i.speed ?? null}
            status={i.status}
            onClick={() => {
              flyTo(i.latitude, i.longitude);
              onMarkerClick?.(i.device_id);
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
