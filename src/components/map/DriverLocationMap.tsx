import { useMemo, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { MapPin, Navigation, Clock, Crosshair, Flag, CircleDot } from 'lucide-react';
import clsx from 'clsx';

type LocationPoint = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  updated_at: string | null;
};

type Props = {
  driverName: string;
  currentLocation: LocationPoint | null;
  locationHistory: LocationPoint[];
  isOnline: boolean;
};

// Create driver marker icon
const createDriverIcon = (isOnline: boolean) => {
  const color = isOnline ? '#10b981' : '#6b7280';
  const ringColor = isOnline ? '#34d399' : '#9ca3af';
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="20" fill="${color}" stroke="${ringColor}" stroke-width="3"/>
      <circle cx="24" cy="24" r="14" fill="white" fill-opacity="0.2"/>
      <path d="M18 28L24 14L30 28Z" fill="white" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      ${isOnline ? `
        <circle cx="24" cy="24" r="22" fill="none" stroke="${ringColor}" stroke-width="2" opacity="0.5">
          <animate attributeName="r" from="22" to="30" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
    </svg>
  `;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Start marker (green flag)
const createStartIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#10b981" stroke="white" stroke-width="2"/>
      <text x="16" y="20" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">S</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// End marker (red flag)
const createEndIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="white" stroke-width="2"/>
      <text x="16" y="20" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">E</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Direction arrow icon
const createArrowIcon = (bearing: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <g transform="rotate(${bearing}, 10, 10)">
        <polygon points="10,2 14,14 10,11 6,14" fill="#3b82f6" stroke="white" stroke-width="1"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

export default function DriverLocationMap({ driverName, currentLocation, locationHistory, isOnline }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const center = useMemo(() => {
    if (currentLocation && currentLocation.latitude !== 0) {
      return { lat: currentLocation.latitude, lng: currentLocation.longitude };
    }
    return { lat: 9.0820, lng: 8.6753 };
  }, [currentLocation]);

  // Path for polyline (from oldest to newest)
  const path = useMemo(() => {
    return [...locationHistory]
      .filter(loc => loc.latitude !== 0 && loc.longitude !== 0)
      .reverse()
      .map(loc => ({ lat: loc.latitude, lng: loc.longitude }));
  }, [locationHistory]);

  // Direction arrows along the path (every ~5th point)
  const directionArrows = useMemo(() => {
    if (path.length < 3) return [];
    const arrows: { position: google.maps.LatLngLiteral; bearing: number }[] = [];
    const step = Math.max(3, Math.floor(path.length / 10));
    for (let i = step; i < path.length - 1; i += step) {
      const bearing = calculateBearing(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
      arrows.push({ position: path[i], bearing });
    }
    return arrows;
  }, [path]);

  // Start and end points
  const startPoint = useMemo(() => path.length > 1 ? path[0] : null, [path]);
  const endPoint = useMemo(() => path.length > 1 ? path[path.length - 1] : null, [path]);

  // Fit bounds only on initial load
  const hasFittedBounds = useRef(false);
  useEffect(() => {
    if (mapRef.current && path.length > 1 && !hasFittedBounds.current) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 60);
      hasFittedBounds.current = true;
    }
  }, [path]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-[600px] rounded-xl border-2 border-dashed border-muted flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Map unavailable</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[600px] rounded-xl border-2 border-border bg-card flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentLocation || currentLocation.latitude === 0) {
    return (
      <div className="h-[600px] rounded-xl border-2 border-dashed border-warning/50 flex items-center justify-center bg-warning/5">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-warning mx-auto mb-2" />
          <p className="text-sm text-warning font-medium">No location data</p>
          <p className="text-xs text-muted-foreground mt-1">Driver hasn't sent location yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[600px] rounded-xl overflow-hidden border-2 border-border">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={14}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ]
        }}
      >
        {/* History path polyline with arrow symbols */}
        {path.length > 1 && (
          <Polyline
            path={path}
            options={{
              strokeColor: '#3b82f6',
              strokeOpacity: 0.8,
              strokeWeight: 4,
              geodesic: true,
              icons: [{
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 3,
                  strokeColor: '#1d4ed8',
                  fillColor: '#3b82f6',
                  fillOpacity: 1,
                },
                offset: '0',
                repeat: '100px',
              }],
            }}
          />
        )}

        {/* Start marker */}
        {startPoint && (
          <Marker
            position={startPoint}
            icon={{
              url: createStartIcon(),
              anchor: new google.maps.Point(16, 16),
            }}
            zIndex={50}
            title="Start"
          />
        )}

        {/* End marker (only if different from current) */}
        {endPoint && path.length > 2 && (
          <Marker
            position={endPoint}
            icon={{
              url: createEndIcon(),
              anchor: new google.maps.Point(16, 16),
            }}
            zIndex={50}
            title="End"
          />
        )}

        {/* Current location marker */}
        <Marker
          position={center}
          icon={{
            url: createDriverIcon(isOnline),
            anchor: new google.maps.Point(24, 24),
          }}
          zIndex={100}
          onClick={() => setHoveredIndex(0)}
        />

        {/* Info window */}
        {hoveredIndex !== null && locationHistory[hoveredIndex] && (
          <InfoWindow
            position={{ 
              lat: locationHistory[hoveredIndex].latitude, 
              lng: locationHistory[hoveredIndex].longitude 
            }}
            onCloseClick={() => setHoveredIndex(null)}
            options={{ pixelOffset: new google.maps.Size(0, -20) }}
          >
            <div className="p-2 min-w-[140px]">
              <p className="font-semibold text-sm text-gray-900">
                {hoveredIndex === 0 ? `📍 ${driverName}` : `Point ${locationHistory.length - hoveredIndex}`}
              </p>
              <div className="mt-1 space-y-1 text-xs text-gray-600">
                {locationHistory[hoveredIndex].speed !== null && (
                  <p className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {Math.round(locationHistory[hoveredIndex].speed || 0)} km/h
                  </p>
                )}
                {locationHistory[hoveredIndex].updated_at && (
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(locationHistory[hoveredIndex].updated_at!).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={clsx(
              'h-3 w-3 rounded-full',
              isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'
            )} />
            <span className="text-muted-foreground">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">End</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-6 bg-primary rounded" />
            <span className="text-muted-foreground">Trail</span>
          </div>
        </div>
      </div>

      {/* Current Location Button */}
      <button
        onClick={() => {
          if (mapRef.current && currentLocation) {
            mapRef.current.panTo({ 
              lat: currentLocation.latitude, 
              lng: currentLocation.longitude 
            });
            mapRef.current.setZoom(15);
          }
        }}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all text-xs font-medium"
        title="Center on current location"
      >
        <Crosshair className="h-3.5 w-3.5 text-primary" />
        <span>Current</span>
      </button>

      {/* Driver info overlay */}
      <div className="absolute top-3 left-3 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'h-2.5 w-2.5 rounded-full',
            isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'
          )} />
          <span className="font-semibold text-sm">{driverName}</span>
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
            isOnline ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {isOnline ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
