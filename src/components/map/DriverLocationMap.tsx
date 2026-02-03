import { useMemo, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { MapPin, Navigation, Clock, Crosshair } from 'lucide-react';
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

// Create history point icon
const createHistoryIcon = (index: number, total: number) => {
  const opacity = Math.max(0.3, 1 - (index / total) * 0.7);
  const size = Math.max(8, 12 - (index / total) * 6);
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}">
      <circle cx="${size}" cy="${size}" r="${size - 1}" fill="hsl(217 91% 60%)" fill-opacity="${opacity}" stroke="white" stroke-width="1"/>
    </svg>
  `;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

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
    return { lat: 9.0820, lng: 8.6753 }; // Nigeria default
  }, [currentLocation]);

  // Path for polyline (from oldest to newest)
  const path = useMemo(() => {
    return [...locationHistory]
      .filter(loc => loc.latitude !== 0 && loc.longitude !== 0)
      .reverse()
      .map(loc => ({ lat: loc.latitude, lng: loc.longitude }));
  }, [locationHistory]);

  // Fit bounds to show all history points
  useEffect(() => {
    if (mapRef.current && path.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [path]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-[300px] rounded-xl border-2 border-dashed border-muted flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Map unavailable</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[300px] rounded-xl border-2 border-border bg-card flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentLocation || currentLocation.latitude === 0) {
    return (
      <div className="h-[300px] rounded-xl border-2 border-dashed border-warning/50 flex items-center justify-center bg-warning/5">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-warning mx-auto mb-2" />
          <p className="text-sm text-warning font-medium">No location data</p>
          <p className="text-xs text-muted-foreground mt-1">Driver hasn't sent location yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] rounded-xl overflow-hidden border-2 border-border">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={14}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ]
        }}
      >
        {/* History path polyline */}
        {path.length > 1 && (
          <Polyline
            path={path}
            options={{
              strokeColor: '#3b82f6',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              geodesic: true,
            }}
          />
        )}

        {/* History markers (skip first which is current) */}
        {locationHistory.slice(1).map((loc, idx) => (
          loc.latitude !== 0 && (
            <Marker
              key={idx}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              icon={{
                url: createHistoryIcon(idx, locationHistory.length),
                anchor: new google.maps.Point(6, 6),
              }}
              onClick={() => setHoveredIndex(idx + 1)}
              zIndex={1}
            />
          )
        ))}

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
            <div className="h-2 w-2 rounded-full bg-primary/60" />
            <span className="text-muted-foreground">History</span>
          </div>
        </div>
      </div>

      {/* Current Location Button - Bottom Right */}
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
