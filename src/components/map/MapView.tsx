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
    <div className="relative map-shell rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: initial.latitude, lng: initial.longitude }}
        zoom={initial.zoom}
        mapTypeId={MAP_STYLES[mapType]}
        onLoad={(map) => { 
          mapRef.current = map;
          if (items.length > 1) {
            setTimeout(() => fitToAll(), 100);
          }
        }}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: mapType === 'roadmap' ? [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            },
            {
              featureType: "transit",
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }]
            }
          ] : []
        }}
      >
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fitToAll} 
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:bg-white dark:hover:bg-slate-800"
          >
            <Scan className="h-3.5 w-3.5 mr-1.5" /> Fit All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:bg-white dark:hover:bg-slate-800"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            {mapType === 'roadmap' ? 'Satellite' : 'Map'}
          </Button>
        </div>
        
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-lg shadow-lg px-3 py-2">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {items.length} Device{items.length !== 1 ? 's' : ''}
            </div>
          </div>
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
