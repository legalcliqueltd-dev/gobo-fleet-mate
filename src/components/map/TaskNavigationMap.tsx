import { useState, useEffect, useRef } from 'react';
import { MapContainer, Polyline } from 'react-leaflet';
import type { Map as LeafletMapType } from 'leaflet';
import { AppTileLayer, DriverMarker, TaskMarker } from '@/components/map/leaflet/LeafletMap';
import { Button } from '@/components/ui/button';
import { X, Navigation, LocateFixed, MapPin } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { getRouteStrokeColor } from '@/lib/mapStyles';

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

export default function TaskNavigationMap({
  dropoffLat,
  dropoffLng,
  taskTitle,
  onClose,
}: TaskNavigationMapProps) {
  const { isDark } = useTheme();
  const mapRef = useRef<LeafletMapType | null>(null);
  const hasFitBounds = useRef(false);
  const lastRouteCalc = useRef(0);

  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
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
          (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng])
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
          [currentPosition.lat, currentPosition.lng],
          [dropoffLat, dropoffLng],
        ]);
        const straight = calculateDistance(currentPosition.lat, currentPosition.lng, dropoffLat, dropoffLng);
        setRouteInfo({ distance: `${straight.toFixed(1)} km (direct)`, duration: '—' });
        setNextStep(null);
      });
  }, [currentPosition, dropoffLat, dropoffLng, routePath.length]);

  // Fit the whole route into view once we know both ends
  useEffect(() => {
    if (hasFitBounds.current || !mapRef.current || !currentPosition) return;
    mapRef.current.fitBounds(
      [
        [currentPosition.lat, currentPosition.lng],
        [dropoffLat, dropoffLng],
      ],
      { padding: [48, 48] }
    );
    hasFitBounds.current = true;
  }, [currentPosition, dropoffLat, dropoffLng]);

  const centerOnMe = () => {
    if (mapRef.current && currentPosition) {
      mapRef.current.setView([currentPosition.lat, currentPosition.lng], 16);
    }
  };

  const openInGoogleMaps = () => {
    if (currentPosition) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentPosition.lat},${currentPosition.lng}&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;
      window.open(url, '_blank');
    }
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
        <MapContainer
          ref={mapRef}
          center={[dropoffLat, dropoffLng]}
          zoom={15}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <AppTileLayer isDark={isDark} mapType="roadmap" />

          {routePath.length > 1 && (
            <Polyline
              positions={routePath}
              pathOptions={{ color: getRouteStrokeColor(isDark), weight: 6, opacity: 0.9 }}
            />
          )}

          {currentPosition && (
            <DriverMarker position={currentPosition} isTracking={true} heading={heading} />
          )}

          <TaskMarker position={{ lat: dropoffLat, lng: dropoffLng }} />
        </MapContainer>

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
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button className="w-full" size="lg" onClick={openInGoogleMaps}>
          <Navigation className="h-5 w-5 mr-2" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
