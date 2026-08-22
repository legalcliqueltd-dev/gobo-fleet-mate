import { useEffect, useRef, useState } from 'react';
import { Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Layers, Loader2, Maximize2, Minimize2, Navigation, X } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useStationProgress, STATE_COLOR, STATE_LABEL } from '@/hooks/useStationProgress';
import { useDriverLocations } from '@/hooks/useDriverLocations';
import { stationMarkerIcon, tierForZoom, type MarkerTier } from '@/lib/stationMarker';
import { getVehicleStatus } from '@/lib/driverStatus';
import { cn } from '@/lib/utils';

export type SheetFocus = {
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** Emphasis colour for the focus pin — an SOS is red, a report amber. */
  tone?: 'alert' | 'info';
};

const STATUS_COLOR: Record<string, string> = {
  moving: '#0b8f4f',
  idle: '#c47d0a',
  offline: '#6b7280',
};

/**
 * An in-app map that slides up from the bottom.
 *
 * Replaces every "open in Google Maps" jump on the manager side. Leaving the
 * app to answer a question is the wrong trade: it drops the incident list,
 * the other alerts and the surrounding fleet, and the manager has to find
 * their way back. Worse, the external map knows nothing about this business —
 * it cannot show that the driver is 200 m from the dump site he was supposed
 * to visit.
 *
 * So this sheet carries the context with it: the point in question, every
 * station with today's completion colour, and every live vehicle. Half height
 * by default so the screen underneath stays visible; expandable to full when
 * something needs a proper look; dismissed with a tap or a downward drag.
 */
export default function LocationSheet({
  focus,
  onClose,
}: {
  focus: SheetFocus | null;
  onClose: () => void;
}) {
  const { isDark } = useTheme();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [tier, setTier] = useState<MarkerTier>('full');
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  const { stations } = useStationProgress(null);
  const { drivers } = useDriverLocations();

  // Re-frame whenever the sheet opens on a new point.
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.panTo({ lat: focus.lat, lng: focus.lng });
    mapRef.current.setZoom(16);
  }, [focus?.lat, focus?.lng]);

  // Height changes the visible map area, so nudge Google to re-measure.
  useEffect(() => {
    if (!mapRef.current) return;
    const id = window.setTimeout(() => {
      google.maps.event.trigger(mapRef.current!, 'resize');
      if (focus) mapRef.current!.panTo({ lat: focus.lat, lng: focus.lng });
    }, 220);
    return () => window.clearTimeout(id);
  }, [expanded, focus]);

  if (!focus) return null;

  const focusColor = focus.tone === 'alert' ? '#dc2626' : '#2563eb';

  return (
    <div className="fixed inset-0 z-[2100] flex flex-col justify-end">
      {/* Scrim — tapping the map's surroundings dismisses, as a sheet should */}
      <button
        type="button"
        aria-label="Close map"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        className={cn(
          'relative flex flex-col overflow-hidden rounded-t-2xl border-t border-border bg-background transition-[height] duration-200',
          expanded ? 'h-[92vh]' : 'h-[58vh]'
        )}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle: pull down to dismiss */}
        <div
          className="shrink-0 cursor-grab touch-none px-4 pb-1 pt-2.5"
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStart.current == null) return;
            setDragY(Math.max(0, e.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            if (dragY > 110) onClose();
            setDragY(0);
            dragStart.current = null;
          }}
        >
          <span className="mx-auto block h-1 w-10 rounded-full bg-muted-foreground/40" />
        </div>

        <div className="flex shrink-0 items-center gap-2 px-4 pb-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-base font-bold">{focus.title}</h3>
            {focus.subtitle && (
              <p className="truncate text-xs text-muted-foreground">{focus.subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label={expanded ? 'Shrink map' : 'Expand map'}
          >
            {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close map"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <MapBody
            focus={focus}
            focusColor={focusColor}
            stations={stations}
            drivers={drivers}
            isDark={isDark}
            mapType={mapType}
            tier={tier}
            onTier={setTier}
            onMap={(map) => {
              mapRef.current = map;
            }}
          />

          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setMapType((t) => (t === 'roadmap' ? 'hybrid' : 'roadmap'))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur"
              aria-label="Toggle satellite"
            >
              <Layers className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                mapRef.current?.panTo({ lat: focus.lat, lng: focus.lng });
                mapRef.current?.setZoom(17);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur"
              aria-label="Back to the point"
            >
              <Navigation className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapBody({
  focus,
  focusColor,
  stations,
  drivers,
  isDark,
  mapType,
  tier,
  onTier,
  onMap,
}: {
  focus: SheetFocus;
  focusColor: string;
  stations: ReturnType<typeof useStationProgress>['stations'];
  drivers: ReturnType<typeof useDriverLocations>['drivers'];
  isDark: boolean;
  mapType: 'roadmap' | 'hybrid';
  tier: MarkerTier;
  onTier: (t: MarkerTier) => void;
  onMap: (map: google.maps.Map) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={{ lat: focus.lat, lng: focus.lng }}
      zoom={16}
      onLoad={(map) => {
        onMap(map);
        onTier(tierForZoom(map.getZoom() ?? 16));
      }}
      onZoomChanged={() => {}}
      options={{
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        mapTypeId: mapType,
        styles: mapType === 'roadmap' ? getNavMapStyle(isDark) : undefined,
      }}
    >
      {/* Stations, so distance to where the driver SHOULD be is visible */}
      {stations.map((s) => {
        const icon = stationMarkerIcon(s.kind, STATE_COLOR[s.state], tier, s.state === 'done');
        return (
          <Marker
            key={s.id}
            position={{ lat: s.latitude, lng: s.longitude }}
            zIndex={2}
            title={`${s.name} — ${STATE_LABEL[s.state]}`}
            icon={{
              url: icon.url,
              scaledSize: new google.maps.Size(icon.width, icon.height),
              anchor: new google.maps.Point(icon.anchorX, icon.anchorY),
            }}
          />
        );
      })}

      {/* Live vehicles */}
      {drivers
        .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
        .map((d) => (
          <Marker
            key={d.driver_id}
            position={{ lat: d.latitude, lng: d.longitude }}
            zIndex={3}
            title={d.driver_name ?? 'Driver'}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor:
                STATUS_COLOR[getVehicleStatus(d.speed ?? 0, d.updated_at ?? d.last_seen_at)],
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2.5,
            }}
          />
        ))}

      {/* The point in question, unmistakable */}
      <Circle
        center={{ lat: focus.lat, lng: focus.lng }}
        radius={60}
        options={{
          strokeColor: focusColor,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: focusColor,
          fillOpacity: 0.15,
          clickable: false,
          zIndex: 4,
        }}
      />
      <Marker
        position={{ lat: focus.lat, lng: focus.lng }}
        zIndex={5}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: focusColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3.5,
        }}
      />
    </GoogleMap>
  );
}
