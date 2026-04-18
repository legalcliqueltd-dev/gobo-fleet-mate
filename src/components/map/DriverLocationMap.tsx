import { useMemo, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, InfoWindow } from '@react-google-maps/api';
import AdvancedMarker from '@/components/map/AdvancedMarker';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { MapPin, Navigation, Clock, Crosshair, Maximize2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

type LocationPoint = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  updated_at?: string | null;
  recorded_at?: string | null;
};

type Props = {
  driverName: string;
  currentLocation: LocationPoint | null;
  locationHistory: LocationPoint[];
  isOnline: boolean;
};

// ---------- Icon factories ----------

const createDriverIcon = (isOnline: boolean) => {
  const body = isOnline ? '#10b981' : '#6b7280';
  const dark = isOnline ? '#059669' : '#4b5563';
  const wheel = isOnline ? '#047857' : '#374151';
  const glow = isOnline ? 'rgba(16,185,129,0.5)' : 'none';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      ${isOnline ? `
        <circle cx="28" cy="28" r="26" fill="${glow}" opacity="0.4">
          <animate attributeName="r" from="22" to="30" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
      <ellipse cx="28" cy="40" rx="10" ry="4" fill="black" opacity="0.12"/>
      <rect x="18" y="14" width="20" height="28" rx="6" fill="${body}" stroke="white" stroke-width="2.5"/>
      <rect x="21" y="16" width="14" height="7" rx="3" fill="${dark}" opacity="0.5"/>
      <rect x="22" y="34" width="12" height="5" rx="2" fill="${dark}" opacity="0.4"/>
      <rect x="14" y="18" width="5" height="8" rx="2" fill="${wheel}" stroke="white" stroke-width="1"/>
      <rect x="14" y="32" width="5" height="8" rx="2" fill="${wheel}" stroke="white" stroke-width="1"/>
      <rect x="37" y="18" width="5" height="8" rx="2" fill="${wheel}" stroke="white" stroke-width="1"/>
      <rect x="37" y="32" width="5" height="8" rx="2" fill="${wheel}" stroke="white" stroke-width="1"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createDotIcon = (color: string, isHighlighted: boolean) => {
  const r = isHighlighted ? 8 : 5;
  const stroke = isHighlighted ? 3 : 1.5;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      ${isHighlighted ? `<circle cx="12" cy="12" r="11" fill="${color}" opacity="0.25"/>` : ''}
      <circle cx="12" cy="12" r="${r}" fill="${color}" stroke="white" stroke-width="${stroke}"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createFlagIcon = (label: 'S' | 'E', color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="20" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createClusterIcon = (count: number) => {
  const size = count >= 50 ? 44 : count >= 10 ? 38 : 32;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#3b82f6" opacity="0.85" stroke="white" stroke-width="2"/>
      <text x="${size / 2}" y="${size / 2 + 5}" font-family="sans-serif" font-size="13" font-weight="bold" fill="white" text-anchor="middle">${count}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// ---------- Helpers ----------

function getTime(p: LocationPoint): string | null {
  return p.recorded_at || p.updated_at || null;
}

function distMeters(a: LocationPoint, b: LocationPoint): number {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

type Cluster = {
  position: google.maps.LatLngLiteral;
  points: Array<{ point: LocationPoint; originalIndex: number }>;
};

/** Group consecutive history points that are within 20m AND 60s of each other. */
function clusterHistory(history: LocationPoint[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (let i = 0; i < history.length; i++) {
    const p = history[i];
    if (p.latitude === 0 && p.longitude === 0) continue;
    const last = clusters[clusters.length - 1];
    const lastP = last?.points[last.points.length - 1].point;
    const tA = lastP ? Date.parse(getTime(lastP) || '') : NaN;
    const tB = Date.parse(getTime(p) || '');
    const sameTime = !isNaN(tA) && !isNaN(tB) && Math.abs(tA - tB) < 60_000;
    if (last && lastP && distMeters(lastP, p) < 20 && sameTime) {
      last.points.push({ point: p, originalIndex: i });
      // recompute centroid
      const lat = last.points.reduce((s, x) => s + x.point.latitude, 0) / last.points.length;
      const lng = last.points.reduce((s, x) => s + x.point.longitude, 0) / last.points.length;
      last.position = { lat, lng };
    } else {
      clusters.push({
        position: { lat: p.latitude, lng: p.longitude },
        points: [{ point: p, originalIndex: i }],
      });
    }
  }
  return clusters;
}

function fmtTime(ts: string | null): string {
  if (!ts) return '—';
  try {
    return format(new Date(ts), 'MMM d, h:mm:ss a');
  } catch {
    return ts;
  }
}

// ---------- Component ----------

export default function DriverLocationMap({ driverName, currentLocation, locationHistory, isOnline }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [showCurrentInfo, setShowCurrentInfo] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');

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

  // Oldest -> newest path for polyline
  const orderedHistory = useMemo(() => {
    return [...locationHistory]
      .filter(loc => loc.latitude !== 0 && loc.longitude !== 0)
      .reverse();
  }, [locationHistory]);

  const path = useMemo(
    () => orderedHistory.map(loc => ({ lat: loc.latitude, lng: loc.longitude })),
    [orderedHistory]
  );

  const clusters = useMemo(() => clusterHistory(orderedHistory), [orderedHistory]);

  const startPoint = path.length > 1 ? path[0] : null;
  const endPoint = path.length > 1 ? path[path.length - 1] : null;

  // Fit bounds once
  const hasFittedBounds = useRef(false);
  useEffect(() => {
    if (mapRef.current && path.length > 1 && !hasFittedBounds.current) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      mapRef.current.fitBounds(bounds, 80);
      hasFittedBounds.current = true;
    }
  }, [path]);

  // Highlight from scrubber
  const highlightedHistoryIndex = scrubIndex;
  const highlightedPosition = highlightedHistoryIndex !== null
    ? path[highlightedHistoryIndex]
    : null;

  // Pan map when scrubbing
  useEffect(() => {
    if (highlightedPosition && mapRef.current) {
      mapRef.current.panTo(highlightedPosition);
    }
  }, [highlightedPosition]);

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

  const selectedCluster = selectedClusterIndex !== null ? clusters[selectedClusterIndex] : null;
  const selectedPoint = selectedCluster?.points[selectedPointIndex]?.point;

  return (
    <div className="space-y-2">
      {/* Map */}
      <div className="relative h-[560px] rounded-xl overflow-hidden border-2 border-border">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={14}
          onLoad={(map) => { mapRef.current = map; }}
          mapTypeId={mapType}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            styles: [
              { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
          }}
        >
          {/* Trail polyline */}
          {path.length > 1 && (
            <Polyline
              path={path}
              options={{
                strokeColor: '#3b82f6',
                strokeOpacity: 0.85,
                strokeWeight: 4,
                geodesic: true,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 2.5,
                    strokeColor: '#1d4ed8',
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                  },
                  offset: '0',
                  repeat: '120px',
                }],
              }}
            />
          )}

          {/* Start marker */}
          {startPoint && (
            <AdvancedMarker
              position={startPoint}
              iconUrl={createFlagIcon('S', '#10b981')}
              iconSize={32}
              zIndex={50}
              title="Start"
            />
          )}

          {/* End marker (if different from current) */}
          {endPoint && path.length > 2 && (
            <AdvancedMarker
              position={endPoint}
              iconUrl={createFlagIcon('E', '#ef4444')}
              iconSize={32}
              zIndex={50}
              title="End"
            />
          )}

          {/* History clusters / dots */}
          {clusters.map((cluster, i) => {
            const isCluster = cluster.points.length > 1;
            const isHighlighted =
              highlightedHistoryIndex !== null &&
              cluster.points.some(p => p.originalIndex === highlightedHistoryIndex);
            const iconUrl = isCluster
              ? createClusterIcon(cluster.points.length)
              : createDotIcon('#3b82f6', isHighlighted);
            return (
              <AdvancedMarker
                key={i}
                position={cluster.position}
                iconUrl={iconUrl}
                iconSize={isCluster ? 38 : 18}
                zIndex={isHighlighted ? 90 : 30}
                onClick={() => {
                  setSelectedClusterIndex(i);
                  setSelectedPointIndex(0);
                  setShowCurrentInfo(false);
                }}
              />
            );
          })}

          {/* Highlighted point ring (from scrubber) */}
          {highlightedPosition && (
            <AdvancedMarker
              position={highlightedPosition}
              iconUrl={createDotIcon('#f59e0b', true)}
              iconSize={28}
              zIndex={95}
            />
          )}

          {/* Current location marker */}
          <AdvancedMarker
            position={center}
            iconUrl={createDriverIcon(isOnline)}
            iconSize={48}
            zIndex={100}
            onClick={() => {
              setShowCurrentInfo(true);
              setSelectedClusterIndex(null);
            }}
          />

          {/* InfoWindow for clicked history cluster/point */}
          {selectedCluster && selectedPoint && (
            <InfoWindow
              position={selectedCluster.position}
              onCloseClick={() => setSelectedClusterIndex(null)}
              options={{ pixelOffset: new google.maps.Size(0, -12) }}
            >
              <div className="p-1 min-w-[200px] max-w-[260px]">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-semibold text-sm text-gray-900">
                    {selectedCluster.points.length > 1
                      ? `📍 ${selectedCluster.points.length} points here`
                      : '📍 Location point'}
                  </p>
                </div>

                {/* Cluster pagination */}
                {selectedCluster.points.length > 1 && (
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <button
                      onClick={() => setSelectedPointIndex(i => Math.max(0, i - 1))}
                      disabled={selectedPointIndex === 0}
                      className="px-1.5 py-0.5 rounded border border-gray-300 disabled:opacity-40 text-gray-700"
                    >
                      ◀
                    </button>
                    <span className="text-gray-600">
                      {selectedPointIndex + 1} / {selectedCluster.points.length}
                    </span>
                    <button
                      onClick={() =>
                        setSelectedPointIndex(i =>
                          Math.min(selectedCluster.points.length - 1, i + 1)
                        )
                      }
                      disabled={selectedPointIndex === selectedCluster.points.length - 1}
                      className="px-1.5 py-0.5 rounded border border-gray-300 disabled:opacity-40 text-gray-700"
                    >
                      ▶
                    </button>
                  </div>
                )}

                <div className="space-y-1 text-xs text-gray-700">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-gray-500" />
                    <span className="font-medium">{fmtTime(getTime(selectedPoint))}</span>
                  </p>
                  {selectedPoint.speed !== null && selectedPoint.speed !== undefined && (
                    <p className="flex items-center gap-1.5">
                      <Navigation className="h-3 w-3 text-gray-500" />
                      {Math.round(selectedPoint.speed || 0)} km/h
                    </p>
                  )}
                  {selectedPoint.accuracy !== null && selectedPoint.accuracy !== undefined && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      ±{Math.round(selectedPoint.accuracy)} m accuracy
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 pt-1 border-t border-gray-100 mt-1">
                    Point {selectedCluster.points[selectedPointIndex].originalIndex + 1} of {orderedHistory.length}
                  </p>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* InfoWindow for current location */}
          {showCurrentInfo && (
            <InfoWindow
              position={center}
              onCloseClick={() => setShowCurrentInfo(false)}
              options={{ pixelOffset: new google.maps.Size(0, -28) }}
            >
              <div className="p-1 min-w-[180px]">
                <p className="font-semibold text-sm text-gray-900 mb-1">📍 {driverName}</p>
                <div className="space-y-1 text-xs text-gray-700">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-gray-500" />
                    {fmtTime(currentLocation.updated_at || null)}
                  </p>
                  {currentLocation.speed !== null && (
                    <p className="flex items-center gap-1.5">
                      <Navigation className="h-3 w-3 text-gray-500" />
                      {Math.round(currentLocation.speed || 0)} km/h
                    </p>
                  )}
                  {currentLocation.accuracy !== null && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      ±{Math.round(currentLocation.accuracy || 0)} m
                    </p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Top header pill (collapsible) */}
        <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 pointer-events-none">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg pointer-events-auto overflow-hidden">
            <button
              onClick={() => setHeaderCollapsed(c => !c)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors w-full"
            >
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
              {headerCollapsed
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {!headerCollapsed && (
              <div className="px-3 pb-2 border-t border-border/60 pt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Start
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> End
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Trail point
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1 w-4 bg-primary rounded" /> Path
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right control stack */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={() => setMapType(t => (t === 'roadmap' ? 'hybrid' : 'roadmap'))}
            className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all text-xs font-medium"
            title="Toggle map type"
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>{mapType === 'roadmap' ? 'Map' : 'Sat'}</span>
          </button>
          {path.length > 1 && (
            <button
              onClick={() => {
                if (mapRef.current) {
                  const bounds = new google.maps.LatLngBounds();
                  path.forEach(p => bounds.extend(p));
                  mapRef.current.fitBounds(bounds, 80);
                }
              }}
              className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all text-xs font-medium"
              title="Fit trail to view"
            >
              <Maximize2 className="h-3.5 w-3.5 text-primary" />
              <span>Fit</span>
            </button>
          )}
          <button
            onClick={() => {
              if (mapRef.current && currentLocation) {
                mapRef.current.panTo({
                  lat: currentLocation.latitude,
                  lng: currentLocation.longitude,
                });
                mapRef.current.setZoom(15);
              }
            }}
            className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all text-xs font-medium"
            title="Center on current location"
          >
            <Crosshair className="h-3.5 w-3.5 text-primary" />
            <span>Now</span>
          </button>
        </div>
      </div>

      {/* Scrubber timeline */}
      {orderedHistory.length > 1 && (
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Trail timeline · {orderedHistory.length} points</span>
            </div>
            <div className="font-medium text-foreground tabular-nums">
              {scrubIndex !== null
                ? fmtTime(getTime(orderedHistory[scrubIndex]))
                : `${fmtTime(getTime(orderedHistory[0]))} → ${fmtTime(getTime(orderedHistory[orderedHistory.length - 1]))}`}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={orderedHistory.length - 1}
            value={scrubIndex ?? 0}
            onChange={(e) => setScrubIndex(Number(e.target.value))}
            onMouseLeave={() => setScrubIndex(null)}
            onTouchEnd={() => setScrubIndex(null)}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Start</span>
            <span>Drag to scrub through the trail</span>
            <span>End</span>
          </div>
        </div>
      )}
    </div>
  );
}
