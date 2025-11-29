import { useMemo, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import Button from '../ui/Button';
import { Layers, Scan, Navigation, MapPin } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import clsx from 'clsx';

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
  selectedId?: string | null;
  onMarkerClick?: (deviceId: string) => void;
};

const MAP_STYLES = {
  roadmap: 'roadmap',
  satellite: 'hybrid',
};

// Custom marker SVG creator - Enhanced for driver visibility
const createMarkerIcon = (status: string | null, isSelected: boolean, isDriver: boolean) => {
  const colors = {
    active: { bg: '#10b981', ring: '#34d399', glow: 'rgba(16,185,129,0.4)' },
    idle: { bg: '#f59e0b', ring: '#fbbf24', glow: 'rgba(245,158,11,0.4)' },
    offline: { bg: '#6b7280', ring: '#9ca3af', glow: 'rgba(107,114,128,0.3)' },
  };
  
  const color = colors[status as keyof typeof colors] || colors.offline;
  const size = isSelected ? 52 : (isDriver ? 44 : 34);
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Driver markers are larger and more prominent
  if (isDriver) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <!-- Outer glow for drivers -->
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 4}" fill="${color.glow}" opacity="0.6"/>
        
        <!-- Main circle with gradient -->
        <defs>
          <linearGradient id="driverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color.ring};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color.bg};stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 6}" fill="url(#driverGrad)" stroke="${isSelected ? '#3b82f6' : 'white'}" stroke-width="${isSelected ? 4 : 3}"/>
        
        <!-- Inner highlight -->
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 12}" fill="white" fill-opacity="0.2"/>
        
        <!-- Driver icon (person silhouette) -->
        <circle cx="${centerX}" cy="${centerY - 5}" r="5" fill="white"/>
        <ellipse cx="${centerX}" cy="${centerY + 6}" rx="8" ry="5" fill="white"/>
        
        <!-- Active pulse animation -->
        ${status === 'active' ? `
          <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 6}" fill="none" stroke="${color.ring}" stroke-width="3" opacity="0.6">
            <animate attributeName="r" from="${size/2 - 6}" to="${size/2 + 8}" dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 6}" fill="none" stroke="${color.ring}" stroke-width="2" opacity="0.4">
            <animate attributeName="r" from="${size/2 - 6}" to="${size/2 + 12}" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
          </circle>
        ` : ''}
        
        <!-- Selection ring -->
        ${isSelected ? `
          <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 3}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4 2"/>
        ` : ''}
      </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  
  // Device markers (vehicles)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 2}" fill="${color.bg}" stroke="${isSelected ? '#3b82f6' : color.ring}" stroke-width="${isSelected ? 3 : 2}"/>
      <rect x="${centerX - 5}" y="${centerY - 3}" width="10" height="6" rx="1.5" fill="white"/>
      <circle cx="${centerX - 3}" cy="${centerY + 4}" r="2" fill="white"/>
      <circle cx="${centerX + 3}" cy="${centerY + 4}" r="2" fill="white"/>
      ${status === 'active' ? `
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 4}" fill="none" stroke="${color.ring}" stroke-width="2" opacity="0.5">
          <animate attributeName="r" from="${size/2 - 4}" to="${size/2 + 4}" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
    </svg>
  `;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export default function MapView({ items, selectedId, onMarkerClick }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<keyof typeof MAP_STYLES>('roadmap');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Items with valid coordinates (not 0,0)
  const validItems = useMemo(() => 
    items.filter(i => i.latitude !== 0 && i.longitude !== 0),
    [items]
  );
  
  // Use all items for display, valid items for map calculations
  const displayItems = items;

  const initial = useMemo(() => {
    // Default to a reasonable center (e.g., Nigeria/Africa) if no valid locations
    if (validItems.length === 0) return { longitude: 8.6753, latitude: 9.0820, zoom: 5 };
    const [lon, lat] = [validItems[0].longitude, validItems[0].latitude];
    return { longitude: lon, latitude: lat, zoom: 12 };
  }, [validItems]);

  // Fly to selected marker
  useEffect(() => {
    if (selectedId && mapRef.current) {
      const item = displayItems.find(i => i.device_id === selectedId);
      if (item && item.latitude !== 0 && item.longitude !== 0) {
        mapRef.current.panTo({ lat: item.latitude, lng: item.longitude });
        mapRef.current.setZoom(15);
      }
    }
  }, [selectedId, displayItems]);

  const fitToAll = () => {
    if (!mapRef.current || validItems.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    validItems.forEach(i => bounds.extend({ lat: i.latitude, lng: i.longitude }));
    mapRef.current.fitBounds(bounds, 80);
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-[70vh] rounded-2xl border-2 border-dashed border-muted flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Set VITE_GOOGLE_MAPS_API_KEY to see the map.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[70vh] rounded-2xl border-2 border-border bg-card flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] rounded-2xl overflow-hidden border-2 border-border shadow-xl bg-card">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: initial.latitude, lng: initial.longitude }}
        zoom={initial.zoom}
        mapTypeId={MAP_STYLES[mapType]}
        onLoad={(map) => { 
          mapRef.current = map;
          if (validItems.length > 1) {
            setTimeout(() => fitToAll(), 100);
          }
        }}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: mapType === 'roadmap' ? [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#193341" }] },
            { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
          ] : []
        }}
      >
        {/* Map Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fitToAll} 
            className="bg-card/95 backdrop-blur-sm border-border shadow-lg hover:bg-card"
          >
            <Scan className="h-4 w-4 mr-2" /> Fit All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
            className="bg-card/95 backdrop-blur-sm border-border shadow-lg hover:bg-card"
          >
            <Layers className="h-4 w-4 mr-2" />
            {mapType === 'roadmap' ? 'Satellite' : 'Map'}
          </Button>
        </div>
        
        {/* Device/Driver Counter */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl shadow-lg px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" title="Active Drivers">
                <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse"></div>
                <span className="text-sm font-semibold">
                  {displayItems.filter(i => i.device_id.startsWith('driver-') && i.status === 'active').length}
                </span>
                <span className="text-xs text-muted-foreground">drivers</span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-1.5" title="Active Devices">
                <div className="h-2.5 w-2.5 rounded bg-primary/70"></div>
                <span className="text-sm font-semibold">
                  {displayItems.filter(i => !i.device_id.startsWith('driver-') && i.status === 'active').length}
                </span>
                <span className="text-xs text-muted-foreground">devices</span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <span className="text-xs text-muted-foreground">
                {displayItems.length} total
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl shadow-lg px-3 py-2">
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-success"></div>
                  <span className="text-muted-foreground">Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-warning"></div>
                  <span className="text-muted-foreground">Idle</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-muted-foreground"></div>
                  <span className="text-muted-foreground">Offline</span>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-gradient-to-br from-success/80 to-success border-2 border-white shadow-sm"></div>
                  <span className="text-muted-foreground font-medium">Driver</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded bg-primary/60"></div>
                  <span className="text-muted-foreground">Device</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Markers */}
        {displayItems.map(item => {
          const isDriver = item.device_id.startsWith('driver-');
          const isSelected = selectedId === item.device_id;
          const markerSize = isSelected ? 52 : (isDriver ? 44 : 34);
          
          return (
            <Marker
              key={item.device_id}
              position={{ lat: item.latitude, lng: item.longitude }}
              icon={{
                url: createMarkerIcon(item.status, isSelected, isDriver),
                anchor: new google.maps.Point(markerSize / 2, markerSize / 2),
              }}
              onClick={() => onMarkerClick?.(item.device_id)}
              onMouseOver={() => setHoveredId(item.device_id)}
              onMouseOut={() => setHoveredId(null)}
              zIndex={isSelected ? 1000 : isDriver ? 500 : (item.status === 'active' ? 100 : 1)}
            />
          );
        })}

        {/* Info Window for hovered marker */}
        {hoveredId && (() => {
          const item = displayItems.find(i => i.device_id === hoveredId);
          if (!item) return null;
          
          return (
            <InfoWindow
              position={{ lat: item.latitude, lng: item.longitude }}
              options={{ 
                pixelOffset: new google.maps.Size(0, -40),
                disableAutoPan: true,
              }}
            >
              <div className="p-2 min-w-[150px]">
                <p className="font-semibold text-sm text-gray-900">
                  {item.is_temporary ? '👤 ' : ''}{item.name || 'Unknown'}
                </p>
                <div className="mt-1 space-y-1 text-xs text-gray-600">
                  <p className="flex items-center gap-1">
                    <span className={clsx(
                      'h-2 w-2 rounded-full',
                      item.status === 'active' ? 'bg-green-500' : 
                      item.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'
                    )}></span>
                    {item.status || 'Unknown'}
                  </p>
                  {item.speed !== null && item.speed > 0 && (
                    <p className="flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      {Math.round(item.speed)} km/h
                    </p>
                  )}
                  {item.timestamp && (
                    <p className="text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </InfoWindow>
          );
        })()}
      </GoogleMap>
    </div>
  );
}
