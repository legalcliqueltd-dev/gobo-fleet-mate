import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Circle, GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import {
  X,
  LocateFixed,
  Play,
  Square,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCw,
  Undo2,
  Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavMapStyle } from '@/lib/mapStyles';
import { stationMarkerIcon } from '@/lib/stationMarker';
import { STATE_COLOR } from '@/hooks/useStationProgress';
import type { StationKind } from '@/integrations/supabase/stations';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  navMapId,
} from '@/lib/googleMapsConfig';

// THE HAND-OFF TO GOOGLE/APPLE MAPS IS GONE, deliberately. Sending a driver
// into another app loses the job, the station, the receipt step and the trail
// the moment he gets there — the thing he was sent to do is no longer on his
// screen. This screen now guides him itself.
//
// (The old comment here claimed App Store Guideline 4 REQUIRES offering Apple
// Maps. It does not; no such rule exists. Restoring the button is a few lines
// if review ever asks.)

/**
 * Compass bearing from a to b, in degrees.
 *
 * `coords.heading` is null whenever the device is not confidently moving —
 * which is most of the time on Android, and ALWAYS on an emulator. Without a
 * fallback the map never rotated, so "heading up" silently meant "north up"
 * and the view never felt like navigation. Two consecutive fixes far enough
 * apart to be movement give the same answer.
 */
function bearingBetween(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The point `meters` from `from` along compass `bearing`. */
function offsetAlong(from: LatLng, bearing: number, meters: number): LatLng {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const d = meters / R;
  const b = rad(bearing);
  const lat1 = rad(from.lat);
  const lng1 = rad(from.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 =
    lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: deg(lng2) };
}

/** Smaller turns than this are route wobble, not a turn — the map holds still. */
const MIN_HEADING_CHANGE = 4;

/** How far the vector map leans. Flat is 0; much past 55 and the horizon
 *  eats the screen on a phone held in one hand. */
const NAV_TILT = 50;

/** Below this, framing both ends is a view of the region, not of the road. */
const MIN_USEFUL_ZOOM = 13;
/** The overview when the destination is far: him, close enough to read streets. */
const OVERVIEW_ZOOM = 16;
/** Guidance: close behind him, the next turn readable before he reaches it. */
const FOLLOW_ZOOM = 18;
/**
 * How far down the screen the driver sits while navigating, as a fraction of
 * the map's height. Centring him wastes the top half on road already driven;
 * every navigation app puts the vehicle low and the road ahead above it, and
 * that is what makes the view feel first-person rather than overhead.
 */
// 0.62, not 0.72: the offset is computed on the flat map, and under a 50°
// tilt the ground behind the centre is stretched, so the same distance lands
// much lower on screen. At 0.72 he could end up under the End button.
const DRIVER_SCREEN_ANCHOR = 0.62;
/** A fix must beat this to count as movement rather than GPS jitter. */
const MIN_BEARING_MOVE_M = 8;
/** How far along the route to look when deciding which way is "ahead". */
const LOOK_AHEAD_M = 60;

type LatLng = { lat: number; lng: number };

type TaskNavigationMapProps = {
  dropoffLat: number;
  dropoffLng: number;
  taskTitle: string;
  onClose: () => void;
  /**
   * Going to a STATION: draw its own badge instead of the generic flag pin,
   * and its arrival zone — the ring the visit is counted inside — so the
   * driver can see where "arrived" begins.
   */
  station?: { kind: StationKind; radiusM: number };
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

/** One instruction on the route: what to do, and where it happens. */
type Step = { instruction: string; at: LatLng; kind: string };

/** The icon for a maneuver — straight, a turn, a roundabout, the finish. */
function stepIcon(kind: string) {
  if (kind === 'arrive') return Flag;
  if (kind === 'roundabout') return RotateCw;
  if (kind.includes('uturn')) return Undo2;
  if (kind.includes('sharp left') || kind === 'left' || kind.endsWith(' left')) {
    return kind.includes('slight') ? ArrowUpLeft : CornerUpLeft;
  }
  if (kind.includes('sharp right') || kind === 'right' || kind.endsWith(' right')) {
    return kind.includes('slight') ? ArrowUpRight : CornerUpRight;
  }
  return ArrowUp;
}

/** Google's step instructions arrive as HTML; the card wants plain words. */
function plainText(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html.replace(/<div[^>]*>/g, ' — ');
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Distance from a point to the nearest vertex of a path, in metres. */
function offRouteMetres(pos: LatLng, path: LatLng[]): number {
  let best = Infinity;
  for (const p of path) best = Math.min(best, calculateDistance(pos.lat, pos.lng, p.lat, p.lng) * 1000);
  return best;
}

/** Metres along the path from its vertex nearest `pos` to its end. */
function remainingMetres(pos: LatLng, path: LatLng[]): number {
  if (path.length < 2) return 0;
  let nearest = 0;
  let best = Infinity;
  path.forEach((p, i) => {
    const d = calculateDistance(pos.lat, pos.lng, p.lat, p.lng);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  // From him to the next vertex ahead, then along the path — so the number
  // falls smoothly between vertices instead of in steps.
  const ahead = Math.min(nearest + 1, path.length - 1);
  let run = calculateDistance(pos.lat, pos.lng, path[ahead].lat, path[ahead].lng) * 1000;
  for (let i = ahead; i < path.length - 1; i++) {
    run += calculateDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng) * 1000;
  }
  return run;
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

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

/**
 * Destination: a navy pin with a white rim, a neon disc and a small flag —
 * "this is where it ends" — standing on a soft shadow so it reads as placed
 * on the map, not printed on it. Tip on the exact point. No red: red is SOS.
 */
const DESTINATION_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="62" viewBox="0 0 48 62">
  <ellipse cx="24" cy="58" rx="9" ry="3.2" fill="#000738" opacity="0.22"/>
  <path d="M24 3C13.5 3 5 11.3 5 21.6 5 34.8 24 55 24 55S43 34.8 43 21.6C43 11.3 34.5 3 24 3Z"
        fill="#000738" stroke="#ffffff" stroke-width="3"/>
  <circle cx="24" cy="21.5" r="10.5" fill="#00ff39"/>
  <path d="M20.5 15.5v12.5" stroke="#000738" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M21 15.8h8.6l-2.2 3.2 2.2 3.2H21Z" fill="#000738"/>
</svg>`;

function destinationIcon(): google.maps.Icon {
  return {
    url: svgUrl(DESTINATION_SVG),
    scaledSize: new google.maps.Size(48, 62),
    anchor: new google.maps.Point(24, 55),
  };
}

/**
 * Him: a navy disc with a neon arrow, like every navigation app's puck. The
 * arrow points the way he should GO — along the route — not a car icon that
 * only says where he is. `rotation` is relative to the screen, so the caller
 * subtracts the map's own heading.
 */
function navPuckIcon(rotation: number): google.maps.Icon {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#00ff39" opacity="0.16"/>
  <circle cx="32" cy="32" r="19" fill="#ffffff"/>
  <circle cx="32" cy="32" r="16" fill="#000738"/>
  <path d="M32 21 L40.5 41 L32 36.2 L23.5 41 Z" fill="#00ff39"
        stroke="#00ff39" stroke-width="1.5" stroke-linejoin="round"
        transform="rotate(${Math.round(rotation)} 32 32)"/>
</svg>`;
  return {
    url: svgUrl(svg),
    scaledSize: new google.maps.Size(64, 64),
    anchor: new google.maps.Point(32, 32),
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
 * Two modes. Before Start it is a flat, north-up overview centred on HIM —
 * the screen answers "where am I and which way do I go", not "where is the
 * destination". Start is guidance: the map leans into 3D, zooms in behind
 * him, turns so the road ahead points up, and follows him until End.
 *
 * Routing still comes from OSRM, which is OpenStreetMap data and free. Only the
 * tiles changed.
 */
export default function TaskNavigationMap({
  dropoffLat,
  dropoffLng,
  taskTitle,
  onClose,
  station,
}: TaskNavigationMapProps) {
  const arriveWithinM = station?.radiusM ?? 50;
  const mapRef = useRef<google.maps.Map | null>(null);
  const hasFitBounds = useRef(false);
  const lastRouteCalc = useRef(0);
  /** Previous fix, used to derive heading when the device will not give one. */
  const lastFixRef = useRef<LatLng | null>(null);
  const mapBoxRef = useRef<HTMLDivElement | null>(null);
  /** The heading the camera was last turned to, to ignore wobble. */
  const cameraHeadingRef = useRef<number | null>(null);
  // THE TWITCH. `center` used to be an inline object literal — a NEW object
  // on every render — and the map library re-applies `center` whenever its
  // identity changes. Every GPS fix and every rotation is a render, so the
  // camera was yanked to the destination on each one and then dragged back
  // to him by the follow code: back and forth, all the time. The starting
  // point is now fixed for the life of the screen.
  const initialCenter = useRef<LatLng>({ lat: dropoffLat, lng: dropoffLng }).current;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  // Always the light map, whatever theme the app is in. The driver reads
  // this screen at a glance while moving; it has to look the same every time.
  const mapId = navMapId();

  // The map's own rotation, so the puck's arrow can be drawn relative to it.
  const [mapHeading, setMapHeading] = useState(0);
  // Bumped each time a map instance loads. The first fix usually lands
  // BEFORE the map exists, and a parked driver gets no new fix — so without
  // this the framing ran once with no map and never again, leaving the
  // screen on the destination.
  const [mapGen, setMapGen] = useState(0);
  // Guidance: 3D, close, and the camera rides with him. `following` drops
  // when he drags the map to look around; recentre picks it back up.
  const [guiding, setGuiding] = useState(false);
  const [following, setFollowing] = useState(false);
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  /** Whole-route totals, used to scale what is left. */
  const [routeTotal, setRouteTotal] = useState<{ metres: number; seconds: number } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  /** The next instruction not yet passed. Starts at the first real turn. */
  const [stepIndex, setStepIndex] = useState(1);
  const [routeSource, setRouteSource] = useState<'osrm' | 'google' | 'direct' | null>(null);
  const routingRef = useRef(false);
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

        // Prefer the device's own heading; fall back to the direction he
        // actually travelled. Without the fallback the map only ever pointed
        // north, because Android withholds heading unless it is sure.
        if (position.coords.heading !== null && !Number.isNaN(position.coords.heading)) {
          setHeading(position.coords.heading);
        } else {
          const prev = lastFixRef.current;
          if (prev && calculateDistance(prev.lat, prev.lng, pos.lat, pos.lng) * 1000 > MIN_BEARING_MOVE_M) {
            setHeading(bearingBetween(prev, pos));
          }
        }
        lastFixRef.current = pos;

        setCurrentPosition(pos);
        setError(null);

        // Arrived: inside the station's own zone, or 50 m of a drop-off.
        const dist = calculateDistance(pos.lat, pos.lng, dropoffLat, dropoffLng);
        setIsArrived(dist < arriveWithinM / 1000);
      },
      (err) => {
        console.error('Location error:', err);
        setError('Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [dropoffLat, dropoffLng, arriveWithinM]);

  // Routing. OSRM first (free); Google Directions if OSRM is slow or down —
  // the route on screen once came up empty because the shared OSRM server
  // did not answer — and a straight line only if both fail. Recalculated
  // ONLY when he leaves the route (> 60 m off it), not on a 30 s clock.
  useEffect(() => {
    if (!currentPosition || !isLoaded || routingRef.current) return;
    const needsRoute =
      routePath.length < 2 ||
      (routeSource !== 'direct' && offRouteMetres(currentPosition, routePath) > 60);
    if (!needsRoute) return;
    if (Date.now() - lastRouteCalc.current < 15_000 && routePath.length > 1) return;
    lastRouteCalc.current = Date.now();
    routingRef.current = true;
    const from = currentPosition;

    const viaOsrm = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${from.lng},${from.lat};${dropoffLng},${dropoffLat}` +
          `?overview=full&geometries=geojson&steps=true`;
        const data = await (await fetch(url, { signal: controller.signal })).json();
        const route = data?.routes?.[0];
        if (!route) throw new Error('no route');
        setRoutePath((route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })));
        setRouteTotal({ metres: route.distance, seconds: route.duration });
        setSteps(
          (route.legs?.[0]?.steps ?? []).map(
            (step: { maneuver: { type: string; modifier?: string; location: [number, number] }; name: string }) => ({
              instruction: describeStep(step),
              at: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
              kind:
                step.maneuver.type === 'arrive'
                  ? 'arrive'
                  : step.maneuver.type === 'roundabout' || step.maneuver.type === 'rotary'
                    ? 'roundabout'
                    : step.maneuver.modifier ?? 'straight',
            })
          )
        );
        setRouteSource('osrm');
      } finally {
        clearTimeout(timer);
      }
    };

    const viaGoogle = async () => {
      const result = await new google.maps.DirectionsService().route({
        origin: from,
        destination: { lat: dropoffLat, lng: dropoffLng },
        travelMode: google.maps.TravelMode.DRIVING,
      });
      const route = result.routes[0];
      const leg = route?.legs[0];
      if (!route || !leg) throw new Error('no route');
      setRoutePath(route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })));
      setRouteTotal({ metres: leg.distance?.value ?? 0, seconds: leg.duration?.value ?? 0 });
      setSteps([
        ...leg.steps.map((step) => ({
          instruction: plainText(step.instructions),
          at: { lat: step.start_location.lat(), lng: step.start_location.lng() },
          kind: (step.maneuver || 'straight').replace(/-/g, ' ').replace('turn ', ''),
        })),
        { instruction: 'Arrive at the drop-off', at: { lat: dropoffLat, lng: dropoffLng }, kind: 'arrive' },
      ]);
      setRouteSource('google');
    };

    void (async () => {
      try {
        await viaOsrm();
      } catch {
        try {
          await viaGoogle();
        } catch {
          // Both routers failed: a straight guide line, honestly labelled.
          setRoutePath([from, { lat: dropoffLat, lng: dropoffLng }]);
          const metres = calculateDistance(from.lat, from.lng, dropoffLat, dropoffLng) * 1000;
          setRouteTotal({ metres, seconds: 0 });
          setSteps([]);
          setRouteSource('direct');
        }
      } finally {
        setStepIndex(1);
        routingRef.current = false;
      }
    })();
  }, [currentPosition, dropoffLat, dropoffLng, routePath, routeSource, isLoaded]);

  // Move on to the next instruction once he reaches the current one.
  useEffect(() => {
    if (!currentPosition || steps.length === 0) return;
    const next = steps[Math.min(stepIndex, steps.length - 1)];
    if (!next || next.kind === 'arrive') return;
    if (calculateDistance(currentPosition.lat, currentPosition.lng, next.at.lat, next.at.lng) * 1000 < 30) {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }
  }, [currentPosition, steps, stepIndex]);

  const nextStep = steps.length ? steps[Math.min(stepIndex, steps.length - 1)] : null;
  const toNextM =
    nextStep && currentPosition
      ? calculateDistance(currentPosition.lat, currentPosition.lng, nextStep.at.lat, nextStep.at.lng) * 1000
      : null;
  const leftM = currentPosition && routePath.length > 1 ? remainingMetres(currentPosition, routePath) : null;
  const leftS =
    routeTotal && leftM != null && routeTotal.metres > 0 && routeTotal.seconds > 0
      ? (routeTotal.seconds * leftM) / routeTotal.metres
      : null;

  // First fix: frame him. Both ends only when the destination is close
  // enough that the result is still a street map; otherwise him alone —
  // a 500 km fit is a view of the region and tells him nothing.
  useEffect(() => {
    if (hasFitBounds.current || mapGen === 0 || !mapRef.current || !currentPosition) return;
    const map = mapRef.current;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(currentPosition);
    bounds.extend({ lat: dropoffLat, lng: dropoffLng });
    map.fitBounds(bounds, 72);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) < MIN_USEFUL_ZOOM) {
        map.setCenter(currentPosition);
        map.setZoom(OVERVIEW_ZOOM);
      }
    });
    hasFitBounds.current = true;
  }, [currentPosition, dropoffLat, dropoffLng, mapGen]);

  /**
   * Which way the road ahead runs.
   *
   * THIS, not the compass, is what should be pointing up the screen. A device
   * heading is null while stationary, lags on a turn, and jitters at walking
   * pace — so the route itself was drawn off to one side and the driver had
   * to read a diagonal line to work out where he was going. The route knows
   * the answer exactly: find where he is on it, look ~60m further along, and
   * aim the camera at that. The road he is about to drive runs straight up
   * the screen, and the map swings round as he takes each turn.
   */
  const routeHeading = useCallback((): number | null => {
    if (!currentPosition || routePath.length < 2) return null;

    // Nearest point on the route to where he actually is.
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < routePath.length; i++) {
      const d = calculateDistance(
        currentPosition.lat, currentPosition.lng,
        routePath[i].lat, routePath[i].lng
      );
      if (d < best) { best = d; nearest = i; }
    }

    // Walk forward until we are far enough along to have a stable direction.
    // Too close and every wobble in the polyline spins the map.
    let ahead = nearest;
    let run = 0;
    while (ahead < routePath.length - 1 && run * 1000 < LOOK_AHEAD_M) {
      run += calculateDistance(
        routePath[ahead].lat, routePath[ahead].lng,
        routePath[ahead + 1].lat, routePath[ahead + 1].lng
      );
      ahead += 1;
    }
    if (ahead === nearest) return null;
    return bearingBetween(currentPosition, routePath[ahead]);
  }, [currentPosition, routePath]);

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

    // The route wins. The compass is the fallback, not the source.
    const target = routeHeading() ?? heading ?? cameraHeadingRef.current ?? 0;
    const last = cameraHeadingRef.current;
    const delta = last == null ? 360 : Math.abs(((target - last + 540) % 360) - 180);
    const up = delta < MIN_HEADING_CHANGE && last != null ? last : target;
    cameraHeadingRef.current = up;

    // ONE camera move, not panTo + panBy. Two moves per fix fought each
    // other — that was the up-and-down shudder. Instead the centre is put
    // ahead of him along the road, so he sits low on the screen with the
    // way forward above him, in a single step.
    // The zoom this move will END at — the offset is measured at that scale,
    // not at whatever the overview was showing when Start was pressed.
    const current = map.getZoom() ?? 0;
    const zoom = current < FOLLOW_ZOOM - 1 ? FOLLOW_ZOOM : current;
    const h = mapBoxRef.current?.clientHeight ?? 0;
    const metersPerPx =
      (156543.03392 * Math.cos((currentPosition.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const aheadM = h * (DRIVER_SCREEN_ANCHOR - 0.5) * metersPerPx;

    map.moveCamera({
      center: mapId ? offsetAlong(currentPosition, up, aheadM) : currentPosition,
      zoom,
      ...(mapId ? { heading: up, tilt: NAV_TILT } : {}),
    });
  }, [currentPosition, heading, mapId, routeHeading]);

  // Follow. Re-runs on every new fix, which is what makes the map MOVE —
  // until now the camera was placed once and then abandoned, so the driver
  // slid off his own screen and nothing brought him back.
  useEffect(() => {
    if (!following) return;
    applyCamera();
  }, [following, applyCamera]);

  // Built once per mode. An inline object here is re-sent to the map on
  // every render — every GPS fix — for no reason.
  //
  // A Map ID switches Google to the vector renderer, which is the only one
  // that honours tilt — that is the 3D view. The same switch moves styling to
  // Cloud Console, so `styles` must NOT be sent alongside it.
  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      ...(mapId
        ? {
            mapId,
            tilt: guiding ? NAV_TILT : 0,
            tiltInteractionEnabled: true,
            headingInteractionEnabled: true,
          }
        : { styles: getNavMapStyle(false) }),
    }),
    [mapId, guiding]
  );

  const startGuidance = useCallback(() => {
    setGuiding(true);
    setFollowing(true);
    applyCamera();
  }, [applyCamera]);

  /** Back to the flat overview, centred on him. */
  const endGuidance = useCallback(() => {
    setGuiding(false);
    setFollowing(false);
    const map = mapRef.current;
    if (!map) return;
    cameraHeadingRef.current = null;
    map.moveCamera({
      ...(currentPosition ? { center: currentPosition, zoom: OVERVIEW_ZOOM } : {}),
      ...(mapId ? { tilt: 0, heading: 0 } : {}),
    });
  }, [currentPosition, mapId]);

  /** Recentre: in guidance, resume following; in overview, just find him. */
  const recentre = useCallback(() => {
    if (guiding) {
      setFollowing(true);
      applyCamera();
      return;
    }
    if (mapRef.current && currentPosition) {
      mapRef.current.panTo(currentPosition);
      if ((mapRef.current.getZoom() ?? 0) < OVERVIEW_ZOOM - 2) mapRef.current.setZoom(OVERVIEW_ZOOM);
    }
  }, [guiding, applyCamera, currentPosition]);

  // The arrow points along the route — the way to go — falling back to the
  // device heading, then to the destination itself. Drawn relative to the
  // map's rotation, and rounded so a jittery compass does not rebuild the
  // icon on every frame.
  const puckRotation = useMemo(() => {
    if (!currentPosition) return 0;
    const bearing =
      routeHeading() ?? heading ?? bearingBetween(currentPosition, { lat: dropoffLat, lng: dropoffLng });
    return Math.round((bearing - mapHeading) / 3) * 3;
  }, [currentPosition, routeHeading, heading, mapHeading, dropoffLat, dropoffLng]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Map */}
      {/* The map runs edge to edge; it stops 24px short of the sheet's
          overlap so Google's logo stays visible, and that strip takes the
          light map's ground colour behind the sheet's rounded corners. */}
      <div ref={mapBoxRef} className="relative min-h-0 flex-1" style={{ backgroundColor: '#edf0f4' }}>
        {!isLoaded ? (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <GoogleMap
            // A Map ID is fixed for the life of a map instance — switching
            // theme has to build a new one, so the id is the React key.
            key={mapId ?? 'raster'}
            mapContainerStyle={{ width: '100%', height: 'calc(100% - 24px)' }}
            center={initialCenter}
            zoom={15}
            onDragStart={() => setFollowing(false)}
            onHeadingChanged={() => setMapHeading(mapRef.current?.getHeading() ?? 0)}
            onLoad={(map) => {
              // The map can be created more than once on the same element
              // (React mounts it twice in development, and any remount does
              // it in production). The framing has to be done on the map
              // that is actually on screen, so each new instance gets it.
              if (mapRef.current !== map) hasFitBounds.current = false;
              mapRef.current = map;
              setMapGen((g) => g + 1);
              // Same pattern as __trackingService: a handle for debugging a
              // map on a real device, where the camera state is the only way
              // to tell a Cloud Console problem from a code problem.
              if (typeof window !== 'undefined') {
                (window as unknown as Record<string, unknown>).__navMap = map;
              }
              if (!mapId) return;
              // A straight answer about the Cloud Console side: if the Map ID
              // was created Raster, renderingType comes back RASTER and the
              // 3D lean in guidance cannot happen.
              console.log(
                '[TaskNavigationMap] renderingType=%s tilt=%s mapId=%s',
                map.getRenderingType?.(),
                map.getTilt(),
                mapId
              );
            }}
            options={mapOptions}
          >
            {/* The route: one bold navy line, the way every tracker draws it.
                The navigation map is always light, so navy always reads. */}
            {routePath.length > 1 && (
              <Polyline
                path={routePath}
                options={{
                  strokeColor: '#000738',
                  strokeOpacity: routeSource === 'direct' ? 0.5 : 1,
                  strokeWeight: 7,
                  clickable: false,
                  zIndex: 2,
                }}
              />
            )}

            {station ? (
              <>
                <Circle
                  center={{ lat: dropoffLat, lng: dropoffLng }}
                  radius={station.radiusM}
                  options={{
                    strokeColor: isArrived ? STATE_COLOR.done : STATE_COLOR.pending,
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: isArrived ? STATE_COLOR.done : STATE_COLOR.pending,
                    fillOpacity: 0.1,
                    clickable: false,
                    zIndex: 1,
                  }}
                />
                {(() => {
                  const icon = stationMarkerIcon(
                    station.kind,
                    isArrived ? STATE_COLOR.arrived : STATE_COLOR.pending,
                    'full'
                  );
                  return (
                    <Marker
                      position={{ lat: dropoffLat, lng: dropoffLng }}
                      zIndex={5}
                      clickable={false}
                      icon={{
                        url: icon.url,
                        scaledSize: new google.maps.Size(icon.width * 1.25, icon.height * 1.25),
                        anchor: new google.maps.Point(icon.anchorX * 1.25, icon.anchorY * 1.25),
                      }}
                    />
                  );
                })()}
              </>
            ) : (
              <Marker
                position={{ lat: dropoffLat, lng: dropoffLng }}
                zIndex={5}
                clickable={false}
                icon={destinationIcon()}
              />
            )}

            {currentPosition && (
              <Marker
                position={currentPosition}
                zIndex={10}
                clickable={false}
                icon={navPuckIcon(puckRotation)}
              />
            )}
          </GoogleMap>
        )}

        {/* The next move, in one card: what to do, and how far until it.
            Before any route exists it just names where he is going. */}
        <div
          className="absolute inset-x-3 z-[1000]"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-brand-ink p-3 text-brand-ink-foreground shadow-xl">
            {(() => {
              const Icon = isArrived ? Flag : stepIcon(nextStep?.kind ?? 'straight');
              return (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-signal">
                  <Icon className="h-6 w-6 text-signal-foreground" strokeWidth={2.5} />
                </span>
              );
            })()}
            <div className="min-w-0 flex-1">
              {isArrived ? (
                <p className="font-heading text-lg font-bold leading-tight">You've arrived</p>
              ) : nextStep && toNextM != null ? (
                <>
                  <p className="telemetry font-heading text-xl font-extrabold leading-none">
                    {formatDistanceM(toNextM)}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-brand-ink-foreground/80">
                    {nextStep.instruction}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-ink-foreground/55">
                    Going to
                  </p>
                  <p className="truncate font-heading text-lg font-bold leading-tight">{taskTitle}</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-ink-foreground/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="absolute left-4 right-4 top-28 z-[1000] rounded-lg bg-destructive/90 p-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        {/* Control rail. Two controls, both about the camera. The
            "Open in Google Maps" slab that used to live down here is gone:
            handing the driver to another app loses the job, the station and
            the receipt step the moment he arrives there. */}
        {!currentPosition && !error && (
          <div className="absolute inset-x-0 top-28 z-[1000] flex justify-center">
            <span className="rounded-full bg-brand-ink px-3.5 py-1.5 text-xs font-semibold text-brand-ink-foreground shadow-lg">
              Finding you…
            </span>
          </div>
        )}

        {/* One camera control. It lights up when the map is not on him —
            the moment he needs it. */}
        <button
          type="button"
          onClick={recentre}
          aria-label="Centre on me"
          className={cn(
            'absolute bottom-10 right-4 z-[1000] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors',
            guiding && !following ? 'bg-signal text-signal-foreground' : 'bg-brand-ink text-signal'
          )}
        >
          <LocateFixed className="h-5 w-5" />
        </button>

      </div>

      {/* The sheet: how long, how far, when — and the one control. */}
      <div
        className="relative z-10 -mt-6 flex items-center gap-3 rounded-t-3xl bg-background px-5 pt-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="min-w-0 flex-1">
          {isArrived ? (
            <p className="font-heading text-2xl font-extrabold leading-none text-success">Arrived</p>
          ) : (
            <p className="telemetry font-heading text-2xl font-extrabold leading-none">
              {leftS != null ? formatDurationS(leftS) : leftM != null ? formatDistanceM(leftM) : '—'}
            </p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {leftM != null && leftS != null && `${formatDistanceM(leftM)} · arrive ${new Date(Date.now() + leftS * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            {routeSource === 'direct' && 'Straight-line distance — no route available'}
            {routeSource === 'osrm' && ' · Route © OpenStreetMap'}
          </p>
        </div>
        {/* Start = guidance: 3D, close behind him, road ahead up, following
            until End. End = back to the flat overview. */}
        <button
          type="button"
          onClick={guiding ? endGuidance : startGuidance}
          disabled={!currentPosition}
          className={cn(
            'flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl px-6',
            'font-heading text-base font-bold tracking-tight transition-colors disabled:opacity-60',
            guiding ? 'bg-brand-ink text-brand-ink-foreground' : 'bg-signal text-signal-foreground'
          )}
        >
          {guiding ? (
            <>
              <Square className="h-4 w-4" />
              End
            </>
          ) : (
            <>
              <Play className="h-[18px] w-[18px]" />
              Start
            </>
          )}
        </button>
      </div>
    </div>
  );
}
