import { useEffect, useMemo, useRef } from 'react';
import Map, { Marker, NavigationControl, ScaleControl, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MarkerData } from '../../types';
import { Car } from 'lucide-react';
import { MAPBOX_TOKEN } from '../../lib/mapboxConfig';

type Props = {
  markers: MarkerData[];
  mapStyle: 'streets' | 'satellite';
  onMapStyleChange: (style: 'streets' | 'satellite') => void;
};

export default function MapView({ markers, mapStyle, onMapStyleChange }: Props) {
  const mapRef = useRef<MapRef | null>(null);

  const styleUrl = mapStyle === 'satellite'
    ? 'mapbox://styles/mapbox/satellite-streets-v12'
    : 'mapbox://styles/mapbox/streets-v12';

  const bounds = useMemo(() => {
    if (!markers.length) return null;
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (const m of markers) {
      minLng = Math.min(minLng, m.longitude);
      minLat = Math.min(minLat, m.latitude);
      maxLng = Math.max(maxLng, m.longitude);
      maxLat = Math.max(maxLat, m.latitude);
    }
    return [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]];
  }, [markers]);

  useEffect(() => {
    if (mapRef.current && bounds) {
      try {
        mapRef.current.fitBounds(bounds, { padding: 60, duration: 700 });
      } catch {}
    }
  }, [JSON.stringify(bounds)]);

  const statusColor = (s?: 'active'|'idle'|'offline') =>
    s === 'active' ? 'bg-emerald-500' : s === 'idle' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <div className="relative">
      <div className="absolute z-10 top-2 left-2 flex gap-2">
        <button
          onClick={() => onMapStyleChange('streets')}
          className={`rounded-md px-3 py-1 text-sm border ${mapStyle==='streets' ? 'bg-white/80 dark:bg-slate-900/80' : 'bg-white/50 dark:bg-slate-800/50'} backdrop-blur`}
        >
          Map
        </button>
        <button
          onClick={() => onMapStyleChange('satellite')}
          className={`rounded-md px-3 py-1 text-sm border ${mapStyle==='satellite' ? 'bg-white/80 dark:bg-slate-900/80' : 'bg-white/50 dark:bg-slate-800/50'} backdrop-blur`}
        >
          Satellite
        </button>
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={styleUrl}
        initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        style={{ width: '100%', height: '60vh', borderRadius: '0.75rem' }}
      >
        <NavigationControl position="top-right" />
        <ScaleControl />

        {markers.map((m) => (
          <Marker key={m.id} longitude={m.longitude} latitude={m.latitude} anchor="bottom">
            <div className="relative -translate-y-1">
              <div className={`h-3 w-3 rounded-full ring-2 ring-white/80 dark:ring-black/40 ${statusColor(m.status)} absolute -top-1 -right-1`}></div>
              <div className="grid place-items-center h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow">
                <Car className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
