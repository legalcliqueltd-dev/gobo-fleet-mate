import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { X, Navigation, LocateFixed, MapPin, Play, Square, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { getRouteStrokeColor, getNavMapStyle } from '@/lib/mapStyles';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  vectorMapId,
} from '@/lib/googleMapsConfig';
import { driverMarkerIcon } from '@/lib/driverMarker';

// THE HAND-OFF TO GOOGLE/APPLE MAPS IS GONE, deliberately. Sending a driver
// into another app loses the job, the station, the receipt step and the trail
// the moment he gets there — the thing he was sent to do is no longer on his
// screen. This screen now guides him itself.
//
// (The old comment here claimed App Store Guideline 4 REQUIRES offering Apple
// Maps. It does not; no such rule exists. Restoring the button is a few lines
// if review ever asks.)

/** How far the vector map leans. Flat is 0; much past 55 and the horizon
 *  eats the screen on a phone held in one hand. */
const NAV_TILT = 50;

/** Below this, the fit has zoomed out so far it is no longer a useful map. */
const MIN_USEFUL_ZOOM = 10;
/** Where we land instead: the destination, close enough to read streets. */
const FAR_AWAY_ZOOM = 15;
/** Close enough to read the next turn, wide enough to see it coming. */
const FOLLOW_ZOOM = 17.5;
const MAP_VIEW_KEY = 'driver_map_view';

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

/**
 * Drop-off pin. Teardrop, tip on the exact point.
 *
 * It used to be `#d32f2f` — the last red left on a driver's map. Red is the
 * SOS colour and nothing else, so the destination is now the brand lockup
 * itself: navy pin, neon rim.
 */
function dropoffIcon(): google.maps.Symbol {
  return {
    path: 'M 0,-10 C 5.5,-10 10,-5.5 10,0 C 10,7 0,16 0,16 C 0,16 -10,7 -10,0 C -10,-5.5 -5.5,-10 0,-10 Z',
    fillColor: '#000738',
    fillOpacity: 1,
    strokeColor: '#00ff39',
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
  const mapId = vectorMapId(isDark);

  // 3D is the default because that is what a driver is used to from every
  // other navigation app, and because a leaning map tells him which way he
  // is pointing without him reading anything. 2D stays one tap away: it is
  // the better view for understanding a junction before you reach it.
  // Remembered, because this is a preference, not a per-trip decision.
  const [view, setView] = useState<'2d' | '3d'>(() => {
    try {
      return localStorage.getItem(MAP_VIEW_KEY) === '2d' ? '2d' : '3d';
    } catch {
      return '3d';
    }
  });
  // Guidance: the camera rides with him instead of sitting where it was left.
  const [following, setFollowing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
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
    const map = mapRef.current;
    map.fitBounds(bounds, 56);

    // Framing BOTH ends is only useful while both ends fit on a phone. A
    // driver who has not started yet — or whose last fix is stale, or who
    // has been given a stop in another state — gets a fit so wide the map
    // is a view of the ocean, and the destination is a dot. Below this
    // zoom, show him the place he is going instead.
    //
    // It also keeps the tilt alive: Google clamps maximum tilt by zoom, so
    // a world-level fit flattens the map no matter what we ask for.
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? MIN_USEFUL_ZOOM) < MIN_USEFUL_ZOOM) {
        map.setCenter({ lat: dropoffLat, lng: dropoffLng });
        map.setZoom(FAR_AWAY_ZOOM);
      }
      if (mapId) map.setTilt(NAV_TILT);
    });

    hasFitBounds.current = true;
  }, [currentPosition, dropoffLat, dropoffLng, isLoaded, mapId]);

  /**
   * Put the camera behind the driver.
   *
   * In 3D this is the whole illusion: lean the map over, turn it so his
   * heading points up the screen, and sit close. In 2D it is just a
   * recentre — north stays up, because a flat map that spins is harder to
   * read, not easier.
   */
  const applyCamera = useCallback(() => {
    const map = mapRef.current;
    if (!map || !currentPosition) return;
    map.panTo(currentPosition);
    if ((map.getZoom() ?? 0) < FOLLOW_ZOOM - 1) map.setZoom(FOLLOW_ZOOM);
    // Tilt and heading are vector-only; on a raster map they are ignored.
    if (!mapId) return;
    map.setTilt(view === '3d' ? NAV_TILT : 0);
    map.setHeading(view === '3d' ? heading ?? 0 : 0);
  }, [currentPosition, heading, mapId, view]);

  // Follow. Re-runs on every new fix, which is what makes the map MOVE —
  // until now the camera was placed once and then abandoned, so the driver
  // slid off his own screen and nothing brought him back.
  useEffect(() => {
    if (!following) return;
    applyCamera();
  }, [following, applyCamera]);

  // Switching 2D/3D re-aims the camera even when he is not navigating, so
  // the toggle does something visible the moment it is pressed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapId) return;
    // Tilt itself comes from the options prop; this only has to undo a
    // rotation, which options does not carry.
    if (view === '2d') map.setHeading(0);
    try {
      localStorage.setItem(MAP_VIEW_KEY, view);
    } catch {
      /* private mode — the preference just will not persist */
    }
  }, [view, mapId]);

  const startGuidance = useCallback(() => {
    setHasStarted(true);
    setFollowing(true);
    applyCamera();
  }, [applyCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* One navy slab carries the whole header: where he is going, how far,
          and the next turn. Three separate bars used to stack here and eat a
          third of the screen before the map began. */}
      <div
        className="relative shrink-0 overflow-hidden bg-brand-ink text-brand-ink-foreground"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="brand-pattern pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-ink-foreground/55">
              Navigating to
            </p>
            <h2 className="truncate font-heading text-lg font-bold leading-tight tracking-tight">
              {taskTitle}
            </h2>
          </div>
          {routeInfo && (
            <p className="telemetry shrink-0 text-right text-sm font-semibold">
              {routeInfo.duration}
              <span className="block text-[11px] font-normal text-brand-ink-foreground/55">
                {routeInfo.distance}
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-ink-foreground/10 text-brand-ink-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {nextStep && !isArrived && (
          <div className="relative flex items-center gap-2.5 border-t border-brand-ink-foreground/10 px-4 py-2.5">
            <Navigation className="h-4 w-4 shrink-0 text-signal" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{nextStep.instruction}</p>
            <p className="telemetry shrink-0 text-xs text-brand-ink-foreground/60">
              {nextStep.distance}
            </p>
          </div>
        )}
      </div>

      {/* Arrival banner */}
      {isArrived && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-success px-4 py-3 font-semibold text-success-foreground">
          <MapPin className="h-4 w-4" />
          You've arrived at the drop-off
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {!isLoaded ? (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <GoogleMap
            // A Map ID is fixed for the life of a map instance — switching
            // theme has to build a new one, so the id is the React key.
            key={mapId ?? 'raster'}
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: dropoffLat, lng: dropoffLng }}
            zoom={15}
            onDragStart={() => setFollowing(false)}
            onLoad={(map) => {
              mapRef.current = map;
              // Same pattern as __trackingService: a handle for debugging a
              // map on a real device, where the camera state is the only way
              // to tell a Cloud Console problem from a code problem.
              if (typeof window !== 'undefined') {
                (window as unknown as Record<string, unknown>).__navMap = map;
              }
              if (!mapId) return;
              // Ask for tilt again after the map exists. The init option is
              // applied before fitBounds runs, and this also gives us a
              // straight answer about the Cloud Console side: if the Map ID
              // was created Raster, renderingType comes back RASTER; if Tilt
              // was left unticked, tilt comes back 0 however often we ask.
              map.setTilt(NAV_TILT);
              console.log(
                '[TaskNavigationMap] renderingType=%s tilt=%s mapId=%s',
                map.getRenderingType?.(),
                map.getTilt(),
                mapId
              );
            }}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
              // A Map ID switches Google to the vector renderer, which is the
              // only one that honours tilt — that is the "3D-like" view. The
              // same switch moves styling to Cloud Console, so `styles` must
              // NOT be sent alongside it or the two conflict.
              // THE BUG THIS FIXES: tilt was hardcoded to NAV_TILT here while
              // the 2D/3D toggle set it imperatively with map.setTilt(). The
              // library re-applies this options object on every render, and
              // pressing the toggle IS a render — so setTilt(0) was undone
              // microseconds later and 2D did nothing at all. The view state
              // owns tilt now, in one place.
              ...(mapId
                ? {
                    mapId,
                    tilt: view === '3d' ? NAV_TILT : 0,
                    tiltInteractionEnabled: true,
                    headingInteractionEnabled: true,
                  }
                : { styles: getNavMapStyle(isDark) }),
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
              const icon = driverMarkerIcon('#00ff39', 'moving', true, heading);
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

        {/* Control rail. Two controls, both about the camera. The
            "Open in Google Maps" slab that used to live down here is gone:
            handing the driver to another app loses the job, the station and
            the receipt step the moment he arrives there. */}
        <div className="absolute bottom-24 right-4 z-[1000] flex flex-col items-end gap-2">
          {mapId && (
            <div className="flex overflow-hidden rounded-full border border-border bg-card shadow-lg">
              {(['2d', '3d'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    'min-h-[40px] px-3.5 font-mono text-xs font-bold tracking-wider transition-colors',
                    view === v
                      ? 'bg-brand-ink text-signal'
                      : 'text-muted-foreground active:bg-muted'
                  )}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={applyCamera}
            aria-label="Centre on me"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-ink text-signal shadow-lg"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {/* THE one control. Before it existed the camera was positioned once
            and then left: the driver drove off his own screen, and dragging
            the map stranded it somewhere he was not. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] px-4 pt-10"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={() => (following ? setFollowing(false) : startGuidance())}
            className={cn(
              'pointer-events-auto flex min-h-[54px] w-full items-center justify-center gap-2.5',
              'rounded-2xl font-heading text-base font-bold tracking-tight shadow-xl transition-colors',
              following
                ? 'border border-border bg-card text-foreground'
                : 'bg-signal text-signal-foreground'
            )}
          >
            {following ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : hasStarted ? (
              <>
                <Crosshair className="h-[18px] w-[18px]" />
                Re-centre
              </>
            ) : (
              <>
                <Play className="h-[18px] w-[18px]" />
                Start
              </>
            )}
          </button>
        </div>

        {/* Route geometry is OpenStreetMap data via OSRM; the ODbL asks for
            credit even though the tiles are now Google's. */}
        <p className="pointer-events-none absolute bottom-[4.75rem] left-3 z-[1000] text-[9px] text-muted-foreground/70">
          Route © OpenStreetMap contributors
        </p>
      </div>

    </div>
  );
}
