import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Layers, Scan, MapPin, Phone, MessageSquare, Navigation, Signal, SignalLow, SignalZero, Clock, Zap } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { useRealtimeDriverLocations, LiveDriverLocation } from '@/hooks/useRealtimeDriverLocations';
import { formatTimeAgo, interpolatePosition, easeOutCubic } from '@/utils/mapInterpolation';
import clsx from 'clsx';

type Props = {
  selectedDriverId?: string | null;
  onDriverSelect?: (driverId: string) => void;
  showDevices?: boolean;
  devices?: Array<{
    device_id: string;
    name: string | null;
    status: 'active' | 'idle' | 'offline' | null;
    latitude: number;
    longitude: number;
    speed: number | null;
    timestamp: string | null;
  }>;
};

const MAP_STYLES = {
  roadmap: 'roadmap',
  satellite: 'hybrid',
};

// Enhanced driver marker with status colors and smooth animation
const createDriverMarkerIcon = (
  status: 'active' | 'idle' | 'offline' | 'stale',
  isSelected: boolean,
  initial: string
) => {
  const colors = {
    active: { bg: '#10b981', ring: '#34d399', glow: 'rgba(16,185,129,0.5)' },
    idle: { bg: '#f59e0b', ring: '#fbbf24', glow: 'rgba(245,158,11,0.4)' },
    offline: { bg: '#6b7280', ring: '#9ca3af', glow: 'rgba(107,114,128,0.3)' },
    stale: { bg: '#9ca3af', ring: '#d1d5db', glow: 'rgba(156,163,175,0.2)' },
  };
  
  const color = colors[status];
  const size = isSelected ? 56 : 48;
  const centerX = size / 2;
  const centerY = size / 2;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <!-- Outer glow/pulse -->
      ${status === 'active' ? `
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 2}" fill="${color.glow}" opacity="0.6">
          <animate attributeName="r" from="${size/2 - 6}" to="${size/2 + 6}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 6}" fill="${color.glow}" opacity="0.4">
          <animate attributeName="r" from="${size/2 - 8}" to="${size/2 + 4}" dur="2s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.4" to="0" dur="2s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      
      <!-- Stale indicator (dashed outline) -->
      ${status === 'stale' ? `
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 4}" fill="none" stroke="${color.ring}" stroke-width="2" stroke-dasharray="4 3" opacity="0.7"/>
      ` : ''}
      
      <!-- Main circle -->
      <defs>
        <linearGradient id="driverGrad${status}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color.ring};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color.bg};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${color.bg}" flood-opacity="0.4"/>
        </filter>
      </defs>
      
      <circle 
        cx="${centerX}" 
        cy="${centerY}" 
        r="${size/2 - 6}" 
        fill="url(#driverGrad${status})" 
        stroke="${isSelected ? '#3b82f6' : 'white'}" 
        stroke-width="${isSelected ? 4 : 3}"
        filter="url(#shadow)"
      />
      
      <!-- Inner highlight -->
      <circle cx="${centerX - 4}" cy="${centerY - 4}" r="${size/4}" fill="white" fill-opacity="0.15"/>
      
      <!-- Initial letter -->
      <text 
        x="${centerX}" 
        y="${centerY + 1}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${isSelected ? 18 : 16}" 
        font-weight="700" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >${initial}</text>
      
      <!-- Selection ring -->
      ${isSelected ? `
        <circle 
          cx="${centerX}" 
          cy="${centerY}" 
          r="${size/2 - 2}" 
          fill="none" 
          stroke="#3b82f6" 
          stroke-width="2"
          opacity="0.8"
        >
          <animate attributeName="stroke-dasharray" from="0 100" to="100 0" dur="0.5s" fill="freeze"/>
        </circle>
      ` : ''}
    </svg>
  `;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Simple device marker
const createDeviceMarkerIcon = (status: string | null, isSelected: boolean) => {
  const colors = {
    active: '#10b981',
    idle: '#f59e0b',
    offline: '#6b7280',
  };
  const color = colors[status as keyof typeof colors] || colors.offline;
  const size = isSelected ? 36 : 28;
  const centerX = size / 2;
  const centerY = size / 2;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 2}" fill="${color}" stroke="${isSelected ? '#3b82f6' : 'white'}" stroke-width="2"/>
      <rect x="${centerX - 4}" y="${centerY - 2.5}" width="8" height="5" rx="1" fill="white"/>
      <circle cx="${centerX - 2}" cy="${centerY + 3}" r="1.5" fill="white"/>
      <circle cx="${centerX + 2}" cy="${centerY + 3}" r="1.5" fill="white"/>
    </svg>
  `;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Driver info card component
function DriverCard({ driver, onClose }: { driver: LiveDriverLocation; onClose: () => void }) {
  const statusColors = {
    active: 'bg-success text-success-foreground',
    idle: 'bg-warning text-warning-foreground',
    offline: 'bg-muted text-muted-foreground',
    stale: 'bg-muted/50 text-muted-foreground',
  };
  
  return (
    <div className="min-w-[220px] p-3 bg-white rounded-lg shadow-lg">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">
            {driver.driver_name || `Driver ${driver.driver_id.slice(0, 8)}`}
          </h4>
          <span className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1',
            statusColors[driver.status]
          )}>
            {driver.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
            {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
          </span>
        </div>
      </div>
      
      <div className="space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-2">
        {driver.speed !== null && driver.speed > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-medium">{Math.round(driver.speed)} km/h</span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>{formatTimeAgo(driver.updated_at || driver.last_seen_at)}</span>
        </div>
        
        {driver.accuracy && (
          <div className="flex items-center gap-1.5">
            <Signal className="h-3 w-3 text-muted-foreground" />
            <span>±{Math.round(driver.accuracy)}m accuracy</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
          <Phone className="h-3 w-3" />
          Call
        </button>
        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
          <MessageSquare className="h-3 w-3" />
          Message
        </button>
      </div>
    </div>
  );
}

// Connection status indicator
function ConnectionIndicator({ status, lastUpdate }: { status: string; lastUpdate: Date | null }) {
  const statusConfig = {
    connected: { icon: Signal, color: 'text-success', label: 'Live' },
    connecting: { icon: SignalLow, color: 'text-warning', label: 'Connecting...' },
    disconnected: { icon: SignalZero, color: 'text-destructive', label: 'Disconnected' },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={clsx('flex items-center gap-1', config.color)}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">{config.label}</span>
      </div>
      {lastUpdate && (
        <span className="text-muted-foreground">
          Last: {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

export default function LiveDriverMap({ selectedDriverId, onDriverSelect, showDevices = true, devices = [] }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<keyof typeof MAP_STYLES>('roadmap');
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  
  const { drivers, loading, error, lastUpdate, connectionStatus } = useRealtimeDriverLocations();
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Animate markers when positions change
  useEffect(() => {
    const animatingDrivers = drivers.filter(d => d.isAnimating && d.previousLatitude && d.previousLongitude);
    
    animatingDrivers.forEach(driver => {
      const startTime = performance.now();
      const duration = 1000; // 1 second animation
      
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        const currentPos = interpolatePosition(
          { lat: driver.previousLatitude!, lng: driver.previousLongitude! },
          { lat: driver.latitude, lng: driver.longitude },
          progress,
          easeOutCubic
        );
        
        setAnimatedPositions(prev => {
          const newMap = new Map(prev);
          newMap.set(driver.driver_id, currentPos);
          return newMap;
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    });
  }, [drivers]);

  // Get animated or actual position for a driver
  const getDriverPosition = useCallback((driver: LiveDriverLocation) => {
    const animated = animatedPositions.get(driver.driver_id);
    if (animated && driver.isAnimating) {
      return animated;
    }
    return { lat: driver.latitude, lng: driver.longitude };
  }, [animatedPositions]);

  // Valid drivers with coordinates
  const validDrivers = useMemo(() => {
    const filtered = drivers.filter(d => d.latitude !== 0 && d.longitude !== 0);
    console.log('🗺️ LiveDriverMap validDrivers:', filtered.length, filtered.map(d => ({ name: d.driver_name, lat: d.latitude, lng: d.longitude })));
    return filtered;
  }, [drivers]);

  // Valid devices with coordinates
  const validDevices = useMemo(() => {
    const filtered = devices.filter(d => d.latitude !== 0 && d.longitude !== 0);
    console.log('🗺️ LiveDriverMap validDevices:', filtered.length);
    return filtered;
  }, [devices]);

  const initial = useMemo(() => {
    const allItems = [...validDrivers, ...validDevices];
    if (allItems.length === 0) return { longitude: 8.6753, latitude: 9.0820, zoom: 5 };
    const [lon, lat] = [allItems[0].longitude, allItems[0].latitude];
    return { longitude: lon, latitude: lat, zoom: 13 };
  }, [validDrivers, validDevices]);

  // Fly to selected driver
  useEffect(() => {
    if (selectedDriverId && mapRef.current) {
      const driver = validDrivers.find(d => d.driver_id === selectedDriverId);
      if (driver) {
        mapRef.current.panTo({ lat: driver.latitude, lng: driver.longitude });
        mapRef.current.setZoom(16);
      }
    }
  }, [selectedDriverId, validDrivers]);

  const fitToAll = () => {
    if (!mapRef.current) return;
    const allItems = [...validDrivers, ...validDevices];
    if (allItems.length === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    allItems.forEach(i => bounds.extend({ lat: i.latitude, lng: i.longitude }));
    mapRef.current.fitBounds(bounds, 80);
  };

  // Debug: Log driver data
  useEffect(() => {
    console.log('🚗 LiveDriverMap: drivers from hook =', drivers.length);
    console.log('🗺️ LiveDriverMap: validDrivers =', validDrivers.length, validDrivers);
    console.log('📍 LiveDriverMap: validDevices =', validDevices.length);
  }, [drivers, validDrivers, validDevices]);

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

  if (!isLoaded || loading) {
    return (
      <div className="h-[70vh] rounded-2xl border-2 border-border bg-card flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading live map...</p>
        </div>
      </div>
    );
  }

  const selectedDriver = validDrivers.find(d => d.driver_id === selectedDriverId);
  const hoveredDriver = hoveredDriverId ? validDrivers.find(d => d.driver_id === hoveredDriverId) : null;

  return (
    <div className="relative h-[70vh] rounded-2xl overflow-hidden border-2 border-border shadow-xl bg-card">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: initial.latitude, lng: initial.longitude }}
        zoom={initial.zoom}
        mapTypeId={MAP_STYLES[mapType]}
        onLoad={(map) => { 
          mapRef.current = map;
          if (validDrivers.length + validDevices.length > 1) {
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
        
        {/* Connection status & counter */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl shadow-lg px-4 py-2.5">
            <div className="flex flex-col gap-2">
              <ConnectionIndicator status={connectionStatus} lastUpdate={lastUpdate} />
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <div className="flex items-center gap-1.5" title="Active Drivers">
                  <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse"></div>
                  <span className="text-sm font-semibold">
                    {validDrivers.filter(d => d.status === 'active').length}
                  </span>
                  <span className="text-xs text-muted-foreground">active</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <span className="text-xs text-muted-foreground">
                  {validDrivers.length} total
                </span>
              </div>
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
            </div>
          </div>
        </div>

        {/* Device Markers */}
        {showDevices && validDevices.map(device => {
          const isSelected = selectedDriverId === device.device_id;
          const markerSize = isSelected ? 36 : 28;
          
          return (
            <Marker
              key={device.device_id}
              position={{ lat: device.latitude, lng: device.longitude }}
              icon={{
                url: createDeviceMarkerIcon(device.status, isSelected),
                anchor: new google.maps.Point(markerSize / 2, markerSize / 2),
              }}
              zIndex={isSelected ? 500 : 100}
            />
          );
        })}

        {/* Driver Markers with smooth animation */}
        {validDrivers.map(driver => {
          const isSelected = selectedDriverId === driver.driver_id;
          const markerSize = isSelected ? 56 : 48;
          const position = getDriverPosition(driver);
          const initial = (driver.driver_name || driver.driver_id)[0].toUpperCase();
          
          // Skip if position is invalid
          if (!position || !position.lat || !position.lng || isNaN(position.lat) || isNaN(position.lng)) {
            console.warn(`⚠️ Invalid position for ${driver.driver_name}:`, position);
            return null;
          }
          
          return (
            <Marker
              key={driver.driver_id}
              position={position}
              icon={{
                url: createDriverMarkerIcon(driver.status, isSelected, initial),
                anchor: new google.maps.Point(markerSize / 2, markerSize / 2),
              }}
              onClick={() => onDriverSelect?.(driver.driver_id)}
              onMouseOver={() => setHoveredDriverId(driver.driver_id)}
              onMouseOut={() => setHoveredDriverId(null)}
              zIndex={isSelected ? 1000 : (driver.status === 'active' ? 800 : 600)}
            />
          );
        })}

        {/* Info Window for hovered/selected driver */}
        {(hoveredDriver || selectedDriver) && (() => {
          const driver = hoveredDriver || selectedDriver;
          if (!driver) return null;
          const position = getDriverPosition(driver);
          
          return (
            <InfoWindow
              position={position}
              options={{ 
                pixelOffset: new google.maps.Size(0, -30),
                disableAutoPan: true,
              }}
              onCloseClick={() => setHoveredDriverId(null)}
            >
              <DriverCard driver={driver} onClose={() => setHoveredDriverId(null)} />
            </InfoWindow>
          );
        })()}
      </GoogleMap>
    </div>
  );
}
