import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, TrafficLayer } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { 
  Layers, Scan, MapPin, Phone, MessageSquare, Navigation, Signal, SignalLow, SignalZero, 
  Clock, Zap, Maximize2, Minimize2, Car, Mountain, Route, Compass, Battery, BatteryLow,
  BatteryWarning, AlertTriangle, WifiOff
} from 'lucide-react';
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
  terrain: 'terrain',
};

// Dark theme map styles
const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3C7680" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
  { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#023e58" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];

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
  const size = isSelected ? 64 : 52;
  const centerX = size / 2;
  const centerY = size / 2;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <!-- Outer glow/pulse -->
      ${status === 'active' ? `
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 2}" fill="${color.glow}" opacity="0.6">
          <animate attributeName="r" from="${size/2 - 6}" to="${size/2 + 8}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 6}" fill="${color.glow}" opacity="0.4">
          <animate attributeName="r" from="${size/2 - 8}" to="${size/2 + 6}" dur="2s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.4" to="0" dur="2s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      
      <!-- Stale indicator (dashed outline) -->
      ${status === 'stale' ? `
        <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 4}" fill="none" stroke="${color.ring}" stroke-width="2" stroke-dasharray="4 3" opacity="0.7"/>
      ` : ''}
      
      <!-- Drop shadow -->
      <defs>
        <linearGradient id="driverGrad${status}${isSelected}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color.ring};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color.bg};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow${status}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="${color.bg}" flood-opacity="0.5"/>
        </filter>
      </defs>
      
      <!-- Main circle -->
      <circle 
        cx="${centerX}" 
        cy="${centerY}" 
        r="${size/2 - 8}" 
        fill="url(#driverGrad${status}${isSelected})" 
        stroke="${isSelected ? '#3b82f6' : 'white'}" 
        stroke-width="${isSelected ? 4 : 3}"
        filter="url(#shadow${status})"
      />
      
      <!-- Inner highlight -->
      <circle cx="${centerX - 5}" cy="${centerY - 5}" r="${size/4}" fill="white" fill-opacity="0.2"/>
      
      <!-- Initial letter -->
      <text 
        x="${centerX}" 
        y="${centerY + 2}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${isSelected ? 22 : 18}" 
        font-weight="700" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
        style="text-shadow: 0 1px 2px rgba(0,0,0,0.3)"
      >${initial}</text>
      
      <!-- Selection ring -->
      ${isSelected ? `
        <circle 
          cx="${centerX}" 
          cy="${centerY}" 
          r="${size/2 - 4}" 
          fill="none" 
          stroke="#3b82f6" 
          stroke-width="3"
          opacity="0.9"
        >
          <animate attributeName="stroke-dasharray" from="0 200" to="200 0" dur="0.6s" fill="freeze"/>
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
  const size = isSelected ? 40 : 32;
  const centerX = size / 2;
  const centerY = size / 2;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="deviceShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${color}" flood-opacity="0.4"/>
        </filter>
      </defs>
      <circle cx="${centerX}" cy="${centerY}" r="${size/2 - 3}" fill="${color}" stroke="${isSelected ? '#3b82f6' : 'white'}" stroke-width="2" filter="url(#deviceShadow)"/>
      <rect x="${centerX - 5}" y="${centerY - 3}" width="10" height="6" rx="1.5" fill="white"/>
      <circle cx="${centerX - 3}" cy="${centerY + 4}" r="2" fill="white"/>
      <circle cx="${centerX + 3}" cy="${centerY + 4}" r="2" fill="white"/>
    </svg>
  `;
  
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Format time since update for display
function formatTimeSince(ms: number | undefined): string {
  if (!ms || ms === Infinity) return 'Never';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Battery icon based on level
function BatteryIcon({ level }: { level?: number }) {
  if (level === undefined) return null;
  if (level < 20) return <BatteryWarning className="h-4 w-4 text-red-400" />;
  if (level < 50) return <BatteryLow className="h-4 w-4 text-amber-400" />;
  return <Battery className="h-4 w-4 text-emerald-400" />;
}

// Enhanced driver info card component
function DriverCard({ driver, onClose }: { driver: LiveDriverLocation; onClose: () => void }) {
  const statusColors = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    idle: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    stale: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const statusLabels = {
    active: 'Active',
    idle: 'Idle',
    offline: 'Offline',
    stale: 'Stale Data',
  };

  const isStale = driver.status === 'stale';
  const isOffline = driver.status === 'offline';
  
  // Display battery - current if online, last known if offline
  const displayBattery = driver.batteryLevel ?? driver.lastBatteryLevel;
  const isLastBattery = !driver.batteryLevel && driver.lastBatteryLevel !== undefined;
  
  // Last known location for offline drivers
  const lastLat = driver.lastKnownLatitude ?? driver.latitude;
  const lastLng = driver.lastKnownLongitude ?? driver.longitude;
  
  return (
    <div className="min-w-[280px] bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden">
      {/* Stale/Offline Warning Banner */}
      {(isStale || isOffline) && (
        <div className={clsx(
          'px-3 py-2 flex items-center gap-2 text-xs font-medium',
          isOffline ? 'bg-gray-600/30 text-gray-300' : 'bg-orange-500/20 text-orange-400'
        )}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {isOffline 
              ? 'Driver is offline - no recent updates' 
              : `Data may be outdated (${formatTimeSince(driver.timeSinceUpdate)})`
            }
          </span>
        </div>
      )}
      
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg',
            isOffline ? 'bg-gray-600' : 'bg-gradient-to-br from-primary to-primary/60'
          )}>
            {(driver.driver_name || 'D').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white text-sm">
              {driver.driver_name || `Driver ${driver.driver_id.slice(0, 8)}`}
            </h4>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                statusColors[driver.status]
              )}>
                {driver.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
                {driver.status === 'stale' && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                {statusLabels[driver.status]}
              </span>
              {driver.isBackground && (
                <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                  <WifiOff className="h-2.5 w-2.5" />
                  BG
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {driver.speed !== null && !isOffline && (
            <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="text-white font-semibold">{Math.round(driver.speed)} km/h</span>
              </div>
              <span className="text-[10px] text-slate-400">Speed</span>
            </div>
          )}
          
          {driver.accuracy && !isOffline && (
            <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-blue-400" />
                <span className="text-white font-semibold">±{Math.round(driver.accuracy)}m</span>
              </div>
              <span className="text-[10px] text-slate-400">Accuracy</span>
            </div>
          )}

          {/* Battery - Current or Last Known */}
          {displayBattery !== undefined && (
            <div className={clsx(
              'bg-slate-800/50 rounded-lg p-2.5 border',
              isLastBattery ? 'border-gray-500/30' : 'border-slate-700/30'
            )}>
              <div className="flex items-center gap-2">
                <BatteryIcon level={displayBattery} />
                <span className={clsx('font-semibold', isLastBattery ? 'text-gray-400' : 'text-white')}>
                  {displayBattery}%
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {isLastBattery ? 'Last Battery' : 'Battery'}
              </span>
            </div>
          )}
        </div>
        
        {/* Last Known Location for offline drivers */}
        {isOffline && lastLat !== 0 && lastLng !== 0 && (
          <div className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <span>Last Location: {lastLat.toFixed(4)}, {lastLng.toFixed(4)}</span>
            </div>
          </div>
        )}
        
        {/* Last update with color coding */}
        <div className={clsx(
          'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
          isStale ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
          isOffline ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' :
          'bg-slate-800/30 text-slate-400'
        )}>
          <Clock className="h-3.5 w-3.5" />
          <span>Last update: {formatTimeSince(driver.timeSinceUpdate)}</span>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex border-t border-slate-700/50">
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors border-r border-slate-700/50">
          <Phone className="h-4 w-4" />
          Call Driver
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
          <Navigation className="h-4 w-4" />
          Navigate
        </button>
      </div>
    </div>
  );
}

// Connection status indicator
function ConnectionIndicator({ status, lastUpdate }: { status: string; lastUpdate: Date | null }) {
  const statusConfig = {
    connected: { icon: Signal, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', label: 'Live' },
    connecting: { icon: SignalLow, color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'Connecting...' },
    disconnected: { icon: SignalZero, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Disconnected' },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-2">
      <div className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', config.bgColor, config.color)}>
        <Icon className="h-3.5 w-3.5" />
        <span>{config.label}</span>
      </div>
      {lastUpdate && (
        <span className="text-[10px] text-muted-foreground">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

// Map control button component
function MapControlButton({ 
  onClick, 
  active, 
  icon: Icon, 
  label,
  className 
}: { 
  onClick: () => void; 
  active?: boolean; 
  icon: React.ElementType; 
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
        'backdrop-blur-md border shadow-lg',
        active 
          ? 'bg-primary text-primary-foreground border-primary' 
          : 'bg-card/90 text-foreground border-border hover:bg-card hover:border-primary/50',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function LiveDriverMap({ selectedDriverId, onDriverSelect, showDevices = true, devices = [] }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<keyof typeof MAP_STYLES>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openInfoWindowId, setOpenInfoWindowId] = useState<string | null>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { drivers, loading, error, lastUpdate, connectionStatus } = useRealtimeDriverLocations();
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Animate markers when positions change
  useEffect(() => {
    const animatingDrivers = drivers.filter(d => d.isAnimating && d.previousLatitude && d.previousLongitude);
    
    animatingDrivers.forEach(driver => {
      const startTime = performance.now();
      const duration = 1000;
      
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
    return drivers.filter(d => d.latitude !== 0 && d.longitude !== 0);
  }, [drivers]);

  // Drivers without location (connected but no GPS)
  const driversWithoutLocation = useMemo(() => {
    return drivers.filter(d => (d.latitude === 0 || d.longitude === 0) && d.status !== 'offline');
  }, [drivers]);

  // Valid devices with coordinates
  const validDevices = useMemo(() => {
    return devices.filter(d => d.latitude !== 0 && d.longitude !== 0);
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

  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.setZoom((mapRef.current.getZoom() || 10) + 1);
    }
  };

  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.setZoom((mapRef.current.getZoom() || 10) - 1);
    }
  };

  const cycleMapType = () => {
    const types: (keyof typeof MAP_STYLES)[] = ['roadmap', 'satellite', 'terrain'];
    const currentIndex = types.indexOf(mapType);
    setMapType(types[(currentIndex + 1) % types.length]);
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-[70vh] rounded-2xl border-2 border-dashed border-muted flex items-center justify-center bg-gradient-to-br from-muted/20 to-muted/5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Google Maps API key required</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Configure your API key to enable the map</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || loading) {
    return (
      <div className="h-[70vh] rounded-2xl border-2 border-border bg-gradient-to-br from-card to-card/50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground mt-4 font-medium">Loading live map...</p>
        </div>
      </div>
    );
  }

  const openInfoDriver = openInfoWindowId ? validDrivers.find(d => d.driver_id === openInfoWindowId) : null;

  return (
    <div 
      ref={containerRef}
      className={clsx(
        "relative rounded-2xl overflow-hidden border-2 border-border shadow-2xl bg-card transition-all duration-300",
        isFullscreen ? "h-screen" : "h-[70vh]"
      )}
    >
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
          rotateControl: true,
          scaleControl: true,
          styles: mapType === 'roadmap' ? DARK_MAP_STYLES : []
        }}
      >
        {/* Traffic Layer */}
        {showTraffic && <TrafficLayer />}

        {/* Top Left Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <MapControlButton onClick={fitToAll} icon={Scan} label="Fit All" />
          <MapControlButton onClick={cycleMapType} icon={mapType === 'terrain' ? Mountain : Layers} label={mapType.charAt(0).toUpperCase() + mapType.slice(1)} />
          <MapControlButton onClick={() => setShowTraffic(!showTraffic)} active={showTraffic} icon={Car} label="Traffic" />
        </div>
        
        {/* Top Right - Status */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-2xl px-4 py-3">
            <div className="flex flex-col gap-2">
              <ConnectionIndicator status={connectionStatus} lastUpdate={lastUpdate} />
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5" title="Active Drivers on Map">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></div>
                  <span className="text-sm font-bold text-foreground">
                    {validDrivers.filter(d => d.status === 'active').length}
                  </span>
                  <span className="text-xs text-muted-foreground">active</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <span className="text-xs text-muted-foreground font-medium">
                  {validDrivers.length} total
                </span>
              </div>
              {/* Warning for drivers without location */}
              {driversWithoutLocation.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-amber-500/30 text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">
                    {driversWithoutLocation.length} driver{driversWithoutLocation.length > 1 ? 's' : ''} online but no GPS
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* No Location Warning Banner */}
        {driversWithoutLocation.length > 0 && validDrivers.length === 0 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 max-w-md">
            <div className="bg-amber-500/20 backdrop-blur-md border-2 border-amber-500/40 rounded-xl shadow-2xl px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-bold">No Location Data</span>
              </div>
              <p className="text-xs text-amber-300/80">
                {driversWithoutLocation.length} driver{driversWithoutLocation.length > 1 ? 's are' : ' is'} online but not sending GPS coordinates. 
                Make sure "Duty Status" is ON in the driver app.
              </p>
            </div>
          </div>
        )}

        {/* Right Side - Zoom Controls */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
          <button 
            onClick={zoomIn}
            className="w-10 h-10 bg-card/95 backdrop-blur-md border-2 border-border rounded-lg shadow-lg flex items-center justify-center text-foreground hover:bg-card hover:border-primary/50 transition-all"
          >
            <span className="text-xl font-bold">+</span>
          </button>
          <button 
            onClick={zoomOut}
            className="w-10 h-10 bg-card/95 backdrop-blur-md border-2 border-border rounded-lg shadow-lg flex items-center justify-center text-foreground hover:bg-card hover:border-primary/50 transition-all"
          >
            <span className="text-xl font-bold">−</span>
          </button>
          <div className="w-px h-2"></div>
          <button 
            onClick={toggleFullscreen}
            className="w-10 h-10 bg-card/95 backdrop-blur-md border-2 border-border rounded-lg shadow-lg flex items-center justify-center text-foreground hover:bg-card hover:border-primary/50 transition-all"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Bottom Left - Legend */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-2xl px-4 py-3">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30"></div>
                <span className="text-muted-foreground font-medium">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30"></div>
                <span className="text-muted-foreground font-medium">Idle</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-500"></div>
                <span className="text-muted-foreground font-medium">Offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Markers */}
        {validDrivers.map(driver => {
          const isSelected = selectedDriverId === driver.driver_id;
          const position = getDriverPosition(driver);
          const markerSize = isSelected ? 64 : 52;
          const initial = (driver.driver_name || 'D').charAt(0).toUpperCase();
          
          return (
            <Marker
              key={driver.driver_id}
              position={position}
              icon={{
                url: createDriverMarkerIcon(driver.status, isSelected, initial),
                anchor: new google.maps.Point(markerSize / 2, markerSize / 2),
              }}
              onClick={() => {
                setOpenInfoWindowId(openInfoWindowId === driver.driver_id ? null : driver.driver_id);
                onDriverSelect?.(driver.driver_id);
              }}
              zIndex={isSelected ? 1000 : driver.status === 'active' ? 500 : 100}
            />
          );
        })}

        {/* Device Markers */}
        {showDevices && validDevices.map(device => {
          const isSelected = selectedDriverId === device.device_id;
          const markerSize = isSelected ? 40 : 32;
          
          return (
            <Marker
              key={device.device_id}
              position={{ lat: device.latitude, lng: device.longitude }}
              icon={{
                url: createDeviceMarkerIcon(device.status, isSelected),
                anchor: new google.maps.Point(markerSize / 2, markerSize / 2),
              }}
              zIndex={isSelected ? 800 : 50}
            />
          );
        })}

        {/* Info Window */}
        {openInfoDriver && (
          <InfoWindow
            position={getDriverPosition(openInfoDriver)}
            options={{ 
              pixelOffset: new google.maps.Size(0, -30),
              disableAutoPan: false,
            }}
            onCloseClick={() => setOpenInfoWindowId(null)}
          >
            <DriverCard driver={openInfoDriver} onClose={() => setOpenInfoWindowId(null)} />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}