import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Circle, GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { stationMarkerIcon } from '@/lib/stationMarker';
import type { StationKind } from '@/integrations/supabase/stations';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle, getRouteStrokeColor } from '@/lib/mapStyles';

export type LatLng = { lat: number; lng: number };

export type DriverGoogleMapHandle = {
  /** Re-centre on the driver and restore the navigation zoom. */
  recenter: (position: LatLng) => void;
};

type DriverGoogleMapProps = {
  position: LatLng | null;
  heading: number | null;
  accuracy: number | null;
  isTracking: boolean;
  trail: LatLng[];
  tasks: { id: string; lat: number; lng: number }[];
  /** Manager-marked points the driver must attend. */
  stations?: {
    id: string;
    lat: number;
    lng: number;
    name: string;
    color: string;
    kind: StationKind;
    radius: number;
    done: boolean;
  }[];
  mapType: 'roadmap' | 'satellite';
  isDark: boolean;
  follow: boolean;
  onUserDrag: () => void;
  onTaskClick: (taskId: string) => void;
};

const DEFAULT_CENTER: LatLng = { lat: 6.5244, lng: 3.3792 }; // Lagos
const NAV_ZOOM = 17;

/** Interpolate the shorter way around the circle so 350° → 10° never spins backwards. */
function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta * t;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The driver's navigation map, in the Uber / Bolt idiom.
 *
 * Two things separate this from a plain marker-on-a-map:
 *
 * 1. **The vehicle glides.** GPS delivers a fix every few seconds; dropping the
 *    marker straight onto each one makes the car teleport. Here every new fix
 *    becomes the target of a short eased animation, so the puck slides and
 *    turns the way it does in a ride-hailing app. Heading interpolates the
 *    short way around the circle.
 * 2. **The basemap gets out of the way.** POIs, transit and business labels are
 *    stripped by the nav styles, leaving road geometry and the driver.
 *
 * The camera follows via `panTo` (never a live `center` prop) — binding a
 * moving position to `center` is what caused the "map drags itself back" bug
 * elsewhere in this codebase, because every re-render re-applied it.
 */
const DriverGoogleMap = forwardRef<DriverGoogleMapHandle, DriverGoogleMapProps>(function DriverGoogleMap(
  { position, heading, accuracy, isTracking, trail, tasks, stations = [], mapType, isDark, follow, onUserDrag, onTaskClick },
  ref
) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const hasCentered = useRef(false);

  // The animated values actually drawn, distinct from the raw GPS target.
  const [rendered, setRendered] = useState<{ pos: LatLng; heading: number } | null>(null);
  const animation = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    recenter: (target: LatLng) => {
      mapRef.current?.panTo(target);
      mapRef.current?.setZoom(NAV_ZOOM);
    },
  }));

  // Glide to each new fix instead of snapping to it.
  useEffect(() => {
    if (!position) return;

    const from = rendered;
    const targetHeading = heading ?? from?.heading ?? 0;

    if (!from) {
      setRendered({ pos: position, heading: targetHeading });
      return;
    }

    const start = performance.now();
    const DURATION = 900;
    const startPos = from.pos;
    const startHeading = from.heading;

    if (animation.current) cancelAnimationFrame(animation.current);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const e = easeOutCubic(t);
      setRendered({
        pos: {
          lat: startPos.lat + (position.lat - startPos.lat) * e,
          lng: startPos.lng + (position.lng - startPos.lng) * e,
        },
        heading: lerpAngle(startHeading, targetHeading, e),
      });
      if (t < 1) animation.current = requestAnimationFrame(step);
    };

    animation.current = requestAnimationFrame(step);
    return () => {
      if (animation.current) cancelAnimationFrame(animation.current);
    };
    // `rendered` is deliberately excluded: it is the animation's own output and
    // including it would restart the tween on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, heading]);

  // Follow the driver without ever binding position to `center`.
  useEffect(() => {
    if (!follow || !rendered || !mapRef.current) return;
    mapRef.current.panTo(rendered.pos);
  }, [follow, rendered]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (position && !hasCentered.current) {
        map.setCenter(position);
        map.setZoom(NAV_ZOOM);
        hasCentered.current = true;
      }
    },
    [position]
  );

  const options = useMemo<google.maps.MapOptions>(
    () => ({
      styles: mapType === 'satellite' ? undefined : getNavMapStyle(isDark),
      mapTypeId: mapType === 'satellite' ? 'hybrid' : 'roadmap',
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      keyboardShortcuts: false,
      // A slight tilt-free, rotation-free view keeps the mental model simple
      // for drivers glancing down mid-journey.
      rotateControl: false,
      tilt: 0,
    }),
    [isDark, mapType]
  );

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted px-6 text-center">
        <p className="text-sm text-muted-foreground">
          The map could not load. Check your connection and try again.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const puckColor = isTracking ? '#0b8f4f' : '#5b6472';

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={position ?? DEFAULT_CENTER}
      zoom={NAV_ZOOM}
      options={options}
      onLoad={onLoad}
      onDragStart={onUserDrag}
    >
      {/* Travelled path */}
      {trail.length > 1 && (
        <Polyline
          path={trail}
          options={{
            strokeColor: getRouteStrokeColor(isDark),
            strokeOpacity: 0.95,
            strokeWeight: 6,
            clickable: false,
            zIndex: 1,
          }}
        />
      )}

      {/* Manager-marked stations. Completed ones fade back so only what is
          still outstanding holds the driver's attention. */}
      {stations.map((s) => (
        <div key={s.id}>
          <Circle
            center={{ lat: s.lat, lng: s.lng }}
            radius={s.radius}
            options={{
              strokeColor: s.color,
              strokeOpacity: s.done ? 0.25 : 0.7,
              strokeWeight: 1.5,
              fillColor: s.color,
              fillOpacity: s.done ? 0.05 : 0.14,
              clickable: false,
              zIndex: 1,
            }}
          />
          {(() => {
            const icon = stationMarkerIcon(s.kind, s.color, 'full', s.done);
            return (
              <Marker
                position={{ lat: s.lat, lng: s.lng }}
                zIndex={4}
                clickable={false}
                title={s.name}
                icon={{
                  url: icon.url,
                  scaledSize: new google.maps.Size(icon.width, icon.height),
                  anchor: new google.maps.Point(icon.anchorX, icon.anchorY),
                  labelOrigin: new google.maps.Point(icon.width / 2, icon.labelY),
                }}
                label={{
                  text: s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name,
                  color: isDark ? '#dbe2ea' : '#1f2937',
                  fontSize: '10px',
                  fontWeight: '700',
                }}
              />
            );
          })()}
        </div>
      ))}

      {/* Drop-off pins */}
      {tasks.map((task) => (
        <Marker
          key={task.id}
          position={{ lat: task.lat, lng: task.lng }}
          onClick={() => onTaskClick(task.id)}
          zIndex={5}
          icon={{
            path: 'M 0,-10 C 5.5,-10 10,-5.5 10,0 C 10,7 0,16 0,16 C 0,16 -10,7 -10,0 C -10,-5.5 -5.5,-10 0,-10 Z',
            fillColor: '#d32f2f',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
            scale: 1.4,
            anchor: new google.maps.Point(0, 16),
          }}
        />
      ))}

      {rendered && (
        <>
          {/* GPS uncertainty halo */}
          {accuracy != null && accuracy > 0 && accuracy < 500 && (
            <Circle
              center={rendered.pos}
              radius={accuracy}
              options={{
                strokeColor: puckColor,
                strokeOpacity: 0.35,
                strokeWeight: 1,
                fillColor: puckColor,
                fillOpacity: 0.1,
                clickable: false,
                zIndex: 2,
              }}
            />
          )}

          {/* The puck: a dark disc under a white heading arrow, the shape
              ride-hailing apps trained everyone to read. */}
          <Marker
            position={rendered.pos}
            zIndex={10}
            clickable={false}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: puckColor,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
          <Marker
            position={rendered.pos}
            zIndex={11}
            clickable={false}
            icon={{
              path: 'M 0,-5.5 L 4,4.5 L 0,2 L -4,4.5 Z',
              fillColor: '#ffffff',
              fillOpacity: 1,
              strokeWeight: 0,
              rotation: rendered.heading,
              anchor: new google.maps.Point(0, 0),
            }}
          />
        </>
      )}
    </GoogleMap>
  );
});

export default DriverGoogleMap;
