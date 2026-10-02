import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { X, Navigation, LocateFixed, MapPin } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { getRouteStrokeColor, getNavMapStyle } from '@/lib/mapStyles';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { driverMarkerIcon } from '@/lib/driverMarker';

// Apple App Review Guideline 4 requires apps with location/mapping features to
// offer the option to launch the native Apple Maps app. We show the Apple Maps
// button on iOS (native or Safari) and keep Google Maps available as a fallback.
const isIOSDevice =
  Capacitor.getPlatform() === 'ios' ||
  (typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent));

type LatLng = { lat: number; lng: number };

type TaskNavigationMapProps = {
  dropoffLat: number;
  dropoffLng: number;
  taskTitle: string;
  onClose: () => void;
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceM(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDurationS(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/** Turn an OSRM maneuver into a short human instruction. */
function describeStep(step: {
  maneuver: { type: string; modifier?: string };
  name: string;
}): string {
  const road = step.name ? ` onto ${step.name}` : '';
  const modifier = step.maneuver.modifier ? ` ${step.maneuver.modifier}` : '';
  switch (step.maneuver.type) {
    case 'depart': return `Head out${step.name ? ` on ${step.name}` : ''}`;
    case 'arrive': return 'Arrive at the drop-off';
    case 'turn': return `Turn${modifier}${road}`;
    case 'roundabout': return `Take the roundabout${road}`;
    case 'merge': return `Merge${modifier}${road}`;
    case 'fork': return `Keep${modifier}${road}`;
    default: return `Continue${road}`;
  }
}

/** Drop-off pin. Teardrop, tip on the exact point, same red as the task pins. */
function dropoffIcon(): google.maps.Symbol {
  return {
    path: 'M 0,-10 C 5.5,-10 10,-5.5 10,0 C 10,7 0,16 0,16 C 0,16 -10,7 -10,0 C -10,-5.5 -5.5,-10 0,-10 Z',
    fillColor: '#d32f2f',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
    scale: 1.4,
    anchor: new google.maps.Point(0, 16),
  };
}

/**
 * Full-screen route view for a job.
 *
 * MOVED FROM LEAFLET + CARTO TO GOOGLE MAPS. CARTO now requires an API key for
 * their basemaps, and without one every tile came back stamped "API KEY
 * REQUIRED" — the map was unreadable. Google is already paid for and already
 * draws the driver map, the fleet map and the history replay, so this removes
 * the second map vendor rather than buying a key for it.
 *
 * The driver's own marker is the SAME car icon the manager sees on the fleet
 * map, rotated to heading. One symbol for one thing across the whole product.
 *
 * Routing still comes from OSRM, which is OpenStreetMap data and free. Only the
 * tiles changed.
 */
export default function TaskNavigationMap({
  dropoffLat,
  dropoffLng,
  taskTitle,
  onClose,
}: TaskNavigationMapProps) {
  const { isDark } = useTheme();
  const mapRef = useRef<google.maps.Map | null>(null);
  const hasFitBounds = useRef(false);
  const lastRouteCalc = useRef(0);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [nextStep, setNextStep] = useState<{ instruction: string; distance: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isArrived, setIsArrived] = useState(false);

  // Watch current position
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPosition(pos);
        if (position.coords.heading !== null) setHeading(position.coords.heading);
        setError(null);

        // Check arrival (within 50m)
        const dist = calculateDistance(pos.lat, pos.lng, dropoffLat, dropoffLng);
        setIsArrived(dist < 0.05);
      },
      (err) => {
        console.error('Location error:', err);
        setError('Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [dropoffLat, dropoffLng]);

  // Route via OSRM (open-source router) — recalculated at most every 30s
  useEffect(() => {
    if (!currentPosition) return;
    const now = Date.now();
    if (now - lastRouteCalc.current < 30000 && routePath.length > 0) return;
    lastRouteCalc.current = now;

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${currentPosition.lng},${currentPosition.lat};${dropoffLng},${dropoffLat}` +
      `?overview=full&geometries=geojson&steps=true`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const route = data?.routes?.[0];
        if (!route) throw new Error('no route');
        setRoutePath(
          (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng }))
        );
        setRouteInfo({
          distance: formatDistanceM(route.distance),
          duration: formatDurationS(route.duration),
        });
        const step = route.legs?.[0]?.steps?.[0];
        if (step) {
          setNextStep({
            instruction: describeStep(step),
            distance: formatDistanceM(step.distance),
          });
        }
      })
      .catch(() => {
        // Routing service unreachable — fall back to a straight guide line.
        setRoutePath([
          { lat: currentPosition.lat, lng: currentPosition.lng },
          { lat: dropoffLat, lng: dropoffLng },
        ]);
        const straight = calculateDistance(currentPosition.lat, currentPosition.lng, dropoffLat, dropoffLng);
        setRouteInfo({ distance: `${straight.toFixed(1)} km (direct)`, duration: '—' });
        setNextStep(null);
      });
  }, [currentPosition, dropoffLat, dropoffLng, routePath.length]);

  // Fit the whole route into view once we know both ends
  useEffect(() => {
    if (hasFitBounds.current || !mapRef.current || !currentPosition || !isLoaded) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(currentPosition);
    bounds.extend({ lat: dropoffLat, lng: dropoffLng });
    mapRef.current.fitBounds(bounds, 56);
    hasFitBounds.current = true;
  }, [currentPosition, dropoffLat, dropoffLng, isLoaded]);

  const centerOnMe = useCallback(() => {
    if (mapRef.current && currentPosition) {
      mapRef.current.panTo(currentPosition);
      mapRef.current.setZoom(16);
    }
  }, [currentPosition]);

  const openInGoogleMaps = () => {
    if (currentPosition) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentPosition.lat},${currentPosition.lng}&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  };

  const openInAppleMaps = () => {
    // Apple's universal-link format. Opens Apple Maps app on iOS, the web
    // version elsewhere. Omitting saddr lets Maps use the user's current
    // location automatically.
    const url = `https://maps.apple.com/?daddr=${dropoffLat},${dropoffLng}&dirflg=d`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Turn-by-turn info strip */}
      {nextStep && !isArrived && (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
          <Navigation className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{nextStep.instruction}</p>
            <p className="telemetry text-xs opacity-80">{nextStep.distance}</p>
          </div>
        </div>
      )}

      {/* Arrival banner */}
      {isArrived && (
        <div className="flex items-center justify-center gap-2 bg-success px-4 py-3 font-semibold text-success-foreground">
          <MapPin className="h-4 w-4" />
          You've arrived at the drop-off
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex-1 min-w-0">
          <h2 className="truncate font-heading font-bold">{taskTitle}</h2>
          {routeInfo && (
            <p className="telemetry text-sm text-muted-foreground">
              {routeInfo.duration} · {routeInfo.distance}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-11 w-11" aria-label="Close navigation">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!isLoaded ? (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: dropoffLat, lng: dropoffLng }}
            zoom={15}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
              styles: getNavMapStyle(isDark),
            }}
          >
            {/* Casing under the route so it stays readable over any road
                colour, the same treatment the history replay uses. */}
            {routePath.length > 1 && (
              <>
                <Polyline
                  path={routePath}
                  options={{
                    strokeColor: isDark ? '#0b1220' : '#ffffff',
                    strokeOpacity: 0.9,
                    strokeWeight: 10,
                    clickable: false,
                    zIndex: 1,
                  }}
                />
                <Polyline
                  path={routePath}
                  options={{
                    strokeColor: getRouteStrokeColor(isDark),
                    strokeOpacity: 1,
                    strokeWeight: 6,
                    clickable: false,
                    zIndex: 2,
                  }}
                />
              </>
            )}

            <Marker position={{ lat: dropoffLat, lng: dropoffLng }} zIndex={5} icon={dropoffIcon()} />

            {currentPosition && (() => {
              const icon = driverMarkerIcon('#0b8f4f', 'moving', true, heading);
              return (
                <Marker
                  position={currentPosition}
                  zIndex={10}
                  clickable={false}
                  icon={{
                    url: icon.url,
                    scaledSize: new google.maps.Size(icon.size, icon.size),
                    anchor: new google.maps.Point(icon.anchor, icon.anchor),
                  }}
                />
              );
            })()}
          </GoogleMap>
        )}

        {error && (
          <div className="absolute top-4 left-4 right-4 z-[1000] bg-destructive/90 text-destructive-foreground p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full border border-border shadow-lg"
            onClick={centerOnMe}
            aria-label="Center on my location"
          >
            <LocateFixed className="h-5 w-5" />
          </Button>
        </div>

        {/* Route geometry is OpenStreetMap data via OSRM; the ODbL asks for
            credit even though the tiles are now Google's. */}
        <p className="pointer-events-none absolute bottom-1 left-2 z-[1000] text-[9px] text-muted-foreground/70">
          Route © OpenStreetMap contributors
        </p>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-background space-y-2">
        {isIOSDevice && (
          <Button className="w-full" size="lg" onClick={openInAppleMaps}>
            <Navigation className="h-5 w-5 mr-2" />
            Open in Apple Maps
          </Button>
        )}
        <Button
          className="w-full"
          size="lg"
          variant={isIOSDevice ? 'outline' : 'default'}
          onClick={openInGoogleMaps}
        >
          <Navigation className="h-5 w-5 mr-2" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
