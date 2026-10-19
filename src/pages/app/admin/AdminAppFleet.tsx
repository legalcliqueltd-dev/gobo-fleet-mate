import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Fragment } from 'react';
import { Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Car, ChevronDown, ChevronRight, ChevronUp, LocateFixed, Plus } from 'lucide-react';
import VehicleFocusCard from '@/components/admin/VehicleFocusCard';
import { Button } from '@/components/ui/button';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useDriverLocations } from '@/hooks/useDriverLocations';
import { useStationProgress, STATE_COLOR, STATE_LABEL } from '@/hooks/useStationProgress';
import { useStationMapPreference } from '@/hooks/useStationMapPreference';
import { driverMarkerIcon } from '@/lib/driverMarker';
import { useEntitlements } from '@/hooks/useEntitlements';
import { stationMarkerIcon, tierForZoom, type MarkerTier } from '@/lib/stationMarker';
import { getDriverAccent } from '@/lib/driverAccent';
import { distanceMeters } from '@/integrations/supabase/stations';
import {
  formatLastSeen,
  getOfflineReason,
  getVehicleStatus,
  OFFLINE_REASON_TEXT,
  STATUS_CLASSES,
  STATUS_LABEL,
  type VehicleStatus,
} from '@/lib/driverStatus';
import { cn } from '@/lib/utils';

const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos
/**
 * A parked phone's position wanders 20–100 m indoors. The marker holds where
 * it is until the driver has really left — beyond this, or moving — instead
 * of jittering around the map. Every fix is still recorded; this is drawing.
 */
const HOLD_RADIUS_M = 40;

/** Marker fills mirror the status chips so map and list never disagree. */
const STATUS_MARKER_COLOR: Record<VehicleStatus, string> = {
  moving: '#0b8f4f',
  idle: '#c47d0a',
  offline: '#6b7280',
};

/**
 * Live fleet map — the manager's home screen.
 *
 * The map owns the full viewport with a collapsible sheet of vehicles over it,
 * the same collapse pattern the driver app uses for its task card. Tapping a
 * vehicle flies the map to it; the sheet never steals the whole screen.
 *
 * The map's `center` is a frozen constant, never live coordinates — passing
 * moving positions as a prop is what caused the "map drags itself back"
 * bug on the web dashboard.
 */
export default function AdminAppFleet() {
  const { isDark } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Marker detail follows the zoom so pins never tile over the road network.
  const [tier, setTier] = useState<MarkerTier>('small');
  const { drivers, loading } = useDriverLocations();
  const navigate = useNavigate();
  // Selecting a vehicle scopes the round to that driver, so the map answers
  // "has THIS driver finished?" rather than a fleet-wide blur.
  const { stations, summary: stationSummary } = useStationProgress(selectedId);
  const { enabled: showStations } = useStationMapPreference();
  const { canUseStations } = useEntitlements();
  // Hidden when switched off, and when the plan does not include stations.
  const visibleStations = showStations && canUseStations ? stations : [];
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const hasAutoFitted = useRef(false);

  // Closed on arrival — the map is the reason this screen exists. The list
  // opens at half height and only offers 'full' when it actually has more
  // drivers than half can show; a short fleet never jumps up over nothing.
  const [sheetStep, setSheetStep] = useState<'shut' | 'half' | 'full'>('shut');
  const [canGrow, setCanGrow] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sheetOpen = sheetStep !== 'shut';

  // Where each marker is currently drawn, for the hold above.
  const shownAt = useRef(new Map<string, { lat: number; lng: number }>());

  const vehicles = useMemo(
    () =>
      drivers
        .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
        .map((d) => {
          const lastSeen = d.updated_at ?? d.last_seen_at;
          const speedKmh = d.speed ?? 0;
          const fresh = { lat: d.latitude, lng: d.longitude };
          const held = shownAt.current.get(d.driver_id);
          const pos =
            held && speedKmh < 5 && distanceMeters(held, fresh) < HOLD_RADIUS_M ? held : fresh;
          shownAt.current.set(d.driver_id, pos);
          return {
            id: d.driver_id,
            name: d.driver_name?.trim() || 'Unnamed driver',
            lat: pos.lat,
            lng: pos.lng,
            speedKmh,
            accuracyM: d.accuracy,
            lastSeen,
            status: getVehicleStatus(speedKmh, lastSeen),
            offlineReason: getOfflineReason(getVehicleStatus(speedKmh, lastSeen), lastSeen),
            accent: getDriverAccent(d.driver_id),
          };
        })
        .sort((a, b) => {
          const rank: Record<VehicleStatus, number> = { moving: 0, idle: 1, offline: 2 };
          return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
        }),
    [drivers]
  );

  // "Just dropped" means they were reporting minutes ago and then stopped —
  // which is a fault, unlike a driver who has been off since last night.
  const troubled = useMemo(
    () => vehicles.filter((v) => v.offlineReason === 'just_dropped'),
    [vehicles]
  );

  // The focused vehicle drives the card, the halo, and how much map chrome
  // stays on screen — so it is resolved once, here.
  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) ?? null,
    [vehicles, selectedId]
  );

  const counts = useMemo(
    () => ({
      moving: vehicles.filter((v) => v.status === 'moving').length,
      idle: vehicles.filter((v) => v.status === 'idle').length,
      offline: vehicles.filter((v) => v.status === 'offline').length,
    }),
    [vehicles]
  );

  // Open on the most recently active vehicle rather than an arbitrary point —
  // once only, so it never fights the manager's own panning.
  useEffect(() => {
    if (hasAutoFitted.current || !mapRef.current || vehicles.length === 0) return;

    const freshest = [...vehicles].sort(
      (a, b) => new Date(b.lastSeen ?? 0).getTime() - new Date(a.lastSeen ?? 0).getTime()
    )[0];

    mapRef.current.setCenter({ lat: freshest.lat, lng: freshest.lng });
    mapRef.current.setZoom(14);
    hasAutoFitted.current = true;
  }, [vehicles]);

  // Picking a vehicle closes the list. You have made your choice, and the
  // card that replaces it carries every action the row offered.
  const flyTo = (lat: number, lng: number, id: string) => {
    setSelectedId(id);
    setSheetStep('shut');
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(16);
  };

  // Measured at half height only: that is the one step where the answer
  // decides what the arrow does next.
  useLayoutEffect(() => {
    if (sheetStep !== 'half' || !listRef.current) return;
    const el = listRef.current;
    setCanGrow(el.scrollHeight > el.clientHeight + 1);
  }, [sheetStep, vehicles.length, loading]);

  // shut → half → full (only if there is more to show) → shut.
  const stepSheet = () =>
    setSheetStep((step) =>
      step === 'shut' ? 'half' : step === 'half' && canGrow ? 'full' : 'shut'
    );
  const arrowUp = sheetStep === 'shut' || (sheetStep === 'half' && canGrow);

  const zoomToSelected = () => {
    if (!selected || !mapRef.current) return;
    mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
    mapRef.current.setZoom(18);
  };

  const fitAll = () => {
    if (!mapRef.current || vehicles.length === 0) return;
    if (vehicles.length === 1) {
      mapRef.current.panTo({ lat: vehicles[0].lat, lng: vehicles[0].lng });
      mapRef.current.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    vehicles.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
    mapRef.current.fitBounds(bounds, 56);
  };

  return (
    <div className="relative h-full w-full">
      {!isLoaded ? (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={DEFAULT_CENTER}
          zoom={11}
          onLoad={(map) => {
            mapRef.current = map;
            setTier(tierForZoom(map.getZoom() ?? 11));
          }}
          onZoomChanged={() => {
            const zoom = mapRef.current?.getZoom();
            if (zoom != null) setTier(tierForZoom(zoom));
          }}
          options={{
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
            styles: getNavMapStyle(isDark),
          }}
        >
          {/* Stations sit under the vehicles: they are the context a
              position is read against, not the subject of the screen. */}
          {visibleStations.map((s) => (
            <Fragment key={s.id}>
              <Circle
                center={{ lat: s.latitude, lng: s.longitude }}
                radius={s.radius_m}
                options={{
                  strokeColor: STATE_COLOR[s.state],
                  strokeOpacity: s.state === 'done' ? 0.4 : 0.7,
                  strokeWeight: 1.5,
                  fillColor: STATE_COLOR[s.state],
                  fillOpacity: s.state === 'done' ? 0.06 : 0.12,
                  clickable: false,
                  zIndex: 1,
                }}
              />
              {(() => {
                const icon = stationMarkerIcon(s.kind, STATE_COLOR[s.state], tier, s.state === 'done');
                return (
                  <Marker
                    position={{ lat: s.latitude, lng: s.longitude }}
                    zIndex={2}
                    title={`${s.name} — ${STATE_LABEL[s.state]}`}
                    onClick={() => navigate(`/app/admin/stations/${s.id}`)}
                    icon={{
                      url: icon.url,
                      scaledSize: new google.maps.Size(icon.width, icon.height),
                      anchor: new google.maps.Point(icon.anchorX, icon.anchorY),
                      labelOrigin: new google.maps.Point(icon.width / 2, icon.labelY),
                    }}
                    label={
                      tier === 'full'
                        ? {
                            text: s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name,
                            color: isDark ? '#dbe2ea' : '#1f2937',
                            fontSize: '10px',
                            fontWeight: '700',
                          }
                        : undefined
                    }
                  />
                );
              })()}
            </Fragment>
          ))}

          {/* How precise the fix actually is, drawn the way Find My draws it.
              Only when the error is wider than the marker — a 10 m halo hides
              under the car icon and adds nothing but paint. */}
          {selected &&
            selected.accuracyM != null &&
            Number.isFinite(selected.accuracyM) &&
            selected.accuracyM > 25 && (
              <Circle
                center={{ lat: selected.lat, lng: selected.lng }}
                radius={selected.accuracyM}
                options={{
                  strokeColor: selected.accent,
                  strokeOpacity: 0.35,
                  strokeWeight: 1,
                  fillColor: selected.accent,
                  fillOpacity: 0.12,
                  clickable: false,
                  zIndex: 0,
                }}
              />
            )}

          {vehicles.map((v) => {
            const icon = driverMarkerIcon(v.accent, v.status, selectedId === v.id);
            return (
              <Marker
                key={v.id}
                  position={{ lat: v.lat, lng: v.lng }}
                  onClick={() => setSelectedId(v.id)}
                  zIndex={selectedId === v.id ? 1000 : 1}
                  title={`${v.name} — ${STATUS_LABEL[v.status]}`}
                  icon={{
                    url: icon.url,
                    scaledSize: new google.maps.Size(icon.size, icon.size),
                    anchor: new google.maps.Point(icon.anchor, icon.anchor),
                    labelOrigin: new google.maps.Point(icon.anchor, icon.labelY),
                  }}
                  label={{
                    text: v.name.length > 18 ? `${v.name.slice(0, 17)}…` : v.name,
                    color: isDark ? '#e6eaf0' : '#111827',
                    fontSize: '11px',
                    fontWeight: '600',
                  }}
                />
            );
          })}
        </GoogleMap>
      )}

      {/* Drivers whose tracking looks BROKEN, not merely finished. Without
          this the two are indistinguishable on the map, and only one of them
          needs a phone call. */}
      {troubled.length > 0 && (
        <button
          type="button"
          onClick={() => {
            flyTo(troubled[0].lat, troubled[0].lng, troubled[0].id);
          }}
          className="absolute left-3 right-3 top-[4.6rem] z-[1000] flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning/15 px-3 py-2 text-left backdrop-blur"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-warning">
              {troubled.length === 1
                ? `${troubled[0].name} stopped reporting`
                : `${troubled.length} drivers stopped reporting`}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Tracking may be switched off on their phone
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-warning" />
        </button>
      )}

      {/* One map control. Station progress moved into the sheet handle and
          the satellite toggle went (Stations keeps one); top-right means it
          never has to dodge the sheet or the focus card. */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-3 top-3 z-[1000] h-11 w-11 rounded-full border border-border shadow-lg"
        onClick={fitAll}
        aria-label="Show all vehicles"
      >
        <LocateFixed className="h-5 w-5" />
      </Button>

      {/* Vehicle sheet */}
      <div className="absolute inset-x-0 bottom-0 z-[1000]">
        {selected && (
          <div className="px-3 pb-2">
            <VehicleFocusCard
              vehicle={selected}
              onClose={() => setSelectedId(null)}
              onZoom={zoomToSelected}
              onHistory={() => navigate(`/app/admin/drivers/${selected.id}/history`)}
              onDetails={() => navigate(`/app/admin/drivers/${selected.id}`)}
              onAssignJob={() => navigate(`/app/admin/jobs/new?driver=${selected.id}`)}
            />
          </div>
        )}

        <div
          className="rounded-t-2xl border-t border-border bg-background/95 backdrop-blur"
          style={{ boxShadow: '0 -8px 24px -12px hsl(224 44% 11% / 0.25)' }}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={stepSheet}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              aria-expanded={sheetOpen}
              aria-label={arrowUp ? 'Show more vehicles' : 'Hide vehicles'}
            >
              {/* A live dot while anything is moving: the handle then reads as
                  something worth opening rather than a static bar. */}
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                {counts.moving > 0 && (
                  <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-success opacity-60" />
                )}
                <span
                  className={cn(
                    'relative h-2.5 w-2.5 rounded-full',
                    counts.moving > 0 ? 'bg-success' : 'bg-muted-foreground'
                  )}
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-heading text-sm font-semibold">
                  Vehicles
                  <span className="telemetry ml-1.5 font-normal text-muted-foreground">
                    {vehicles.length}
                  </span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {vehicles.length === 0
                    ? 'No drivers yet'
                    : [
                        counts.moving > 0 ? `${counts.moving} moving` : null,
                        counts.idle > 0 ? `${counts.idle} parked` : null,
                        counts.offline > 0 ? `${counts.offline} offline` : null,
                        stationSummary.total > 0
                          ? `${stationSummary.done} of ${stationSummary.total} stations`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </span>
            </button>

            {/* The one setup action that belongs here, as a glyph. Codes and
                access live in More. */}
            <button
              type="button"
              onClick={() => navigate('/app/admin/drivers/new')}
              aria-label="Add a driver"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Points where the NEXT tap goes: up while there is more to see,
                down once there is not. */}
            <button
              type="button"
              onClick={stepSheet}
              aria-label={arrowUp ? 'Show more vehicles' : 'Hide vehicles'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              {arrowUp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {sheetOpen && (
            <div
              ref={listRef}
              className={cn(
                'overflow-y-auto overscroll-contain px-3 pb-3 transition-[max-height] duration-200',
                sheetStep === 'full' ? 'max-h-[68vh]' : 'max-h-[34vh]'
              )}
            >
              {loading && vehicles.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Loading your fleet…
                </p>
              )}

              {!loading && vehicles.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Tap + to add your first driver.
                </p>
              )}

              {/* Same row as the More sheet: tile, name, one line. The tile's
                  dot carries the status, so there is no chip to read. */}
              <ul>
                {vehicles.map((v) => {
                  const note =
                    v.status === 'moving'
                      ? `Moving · ${Math.round(v.speedKmh)} km/h`
                      : v.offlineReason
                        ? OFFLINE_REASON_TEXT[v.offlineReason]
                        : `Parked · ${formatLastSeen(v.lastSeen)}`;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => flyTo(v.lat, v.lng, v.id)}
                        className={cn(
                          'flex min-h-[56px] w-full items-center gap-3.5 rounded-xl px-2.5 py-2 text-left transition-colors active:bg-muted',
                          selectedId === v.id && 'bg-muted'
                        )}
                      >
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                          <Car className="h-[18px] w-[18px] text-accent-foreground" />
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background',
                              STATUS_CLASSES[v.status].dot
                            )}
                            aria-hidden="true"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{v.name}</span>
                          <span
                            className={cn(
                              'block truncate text-xs',
                              v.offlineReason === 'just_dropped' ? 'text-warning' : 'text-muted-foreground'
                            )}
                          >
                            {note}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
