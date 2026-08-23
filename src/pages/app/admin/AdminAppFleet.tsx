import { useEffect, useMemo, useRef, useState } from 'react';
import { Fragment } from 'react';
import { Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, ChevronUp, KeyRound, Layers, LocateFixed, Plus, RefreshCw, Users, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { useDriverLocations } from '@/hooks/useDriverLocations';
import { useStationProgress, STATE_COLOR, STATE_LABEL } from '@/hooks/useStationProgress';
import { useStationMapPreference } from '@/hooks/useStationMapPreference';
import { useEntitlements } from '@/hooks/useEntitlements';
import { stationMarkerIcon, tierForZoom, type MarkerTier } from '@/lib/stationMarker';
import { getDriverAccent } from '@/lib/driverAccent';
import {
  formatLastSeen,
  getVehicleStatus,
  STATUS_CLASSES,
  STATUS_LABEL,
  type VehicleStatus,
} from '@/lib/driverStatus';
import { cn } from '@/lib/utils';

const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos

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
  const [showRoundChip, setShowRoundChip] = useState(true);
  const { drivers, loading, refetch } = useDriverLocations();
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

  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [sheetOpen, setSheetOpen] = useState(true);

  const vehicles = useMemo(
    () =>
      drivers
        .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
        .map((d) => {
          const lastSeen = d.updated_at ?? d.last_seen_at;
          const speedKmh = d.speed ?? 0;
          return {
            id: d.driver_id,
            name: d.driver_name?.trim() || 'Unnamed driver',
            lat: d.latitude,
            lng: d.longitude,
            speedKmh,
            lastSeen,
            status: getVehicleStatus(speedKmh, lastSeen),
            accent: getDriverAccent(d.driver_id),
          };
        })
        .sort((a, b) => {
          const rank: Record<VehicleStatus, number> = { moving: 0, idle: 1, offline: 2 };
          return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
        }),
    [drivers]
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

  const flyTo = (lat: number, lng: number, id: string) => {
    setSelectedId(id);
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(16);
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
            mapTypeId: mapType === 'satellite' ? 'hybrid' : 'roadmap',
            styles: mapType === 'satellite' ? undefined : getNavMapStyle(isDark),
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

          {vehicles.map((v) => (
            <Marker
              key={v.id}
              position={{ lat: v.lat, lng: v.lng }}
              onClick={() => setSelectedId(v.id)}
              zIndex={selectedId === v.id ? 1000 : 1}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: selectedId === v.id ? 12 : 9,
                fillColor: STATUS_MARKER_COLOR[v.status],
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: selectedId === v.id ? 3.5 : 2.5,
                // Push the name clear of the disc so the two never overlap.
                labelOrigin: new google.maps.Point(0, selectedId === v.id ? 3.4 : 3.9),
              }}
              label={{
                text: v.name.length > 18 ? `${v.name.slice(0, 17)}…` : v.name,
                color: isDark ? '#e6eaf0' : '#111827',
                fontSize: '11px',
                fontWeight: '600',
              }}
            />
          ))}
        </GoogleMap>
      )}

      {/* Status summary */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex gap-2">
        {(['moving', 'idle', 'offline'] as VehicleStatus[]).map((status) => (
          <div
            key={status}
            className="pointer-events-auto flex flex-1 items-center gap-2 rounded-xl border border-border bg-background/90 px-2.5 py-2 backdrop-blur"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_CLASSES[status].dot)} />
            <div className="min-w-0">
              <p className="telemetry text-sm font-bold leading-none">{counts[status]}</p>
              <p className="truncate text-[10px] text-muted-foreground">{STATUS_LABEL[status]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Station progress. The bare "2/10" read as a mystery number, so it now
          says what it counts, and can be dismissed for managers who do not run
          stations at all. */}
      {stationSummary.total > 0 && showRoundChip && (
        <div
          className={cn(
            'absolute left-3 z-[1000] flex items-center gap-3 rounded-xl border border-border bg-background/95 px-3 py-2 backdrop-blur transition-all',
            sheetOpen ? 'bottom-[13.5rem]' : 'bottom-20'
          )}
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Stations visited today
            </p>
            <p className="telemetry text-sm font-bold leading-tight">
              {stationSummary.done}
              <span className="font-normal text-muted-foreground"> of {stationSummary.total}</span>
              {selectedId && (
                <span className="ml-1.5 text-[11px] font-medium text-primary">this driver</span>
              )}
            </p>
          </div>

          <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{
                width: `${stationSummary.total ? (stationSummary.done / stationSummary.total) * 100 : 0}%`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowRoundChip(false)}
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
            aria-label="Hide station progress"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Map controls */}
      <div
        className={cn(
          'absolute right-3 z-[1000] flex flex-col gap-2 transition-all',
          sheetOpen ? 'bottom-[13.5rem]' : 'bottom-20'
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 rounded-full border border-border shadow-lg"
          onClick={() => setMapType((t) => (t === 'roadmap' ? 'satellite' : 'roadmap'))}
          aria-label={mapType === 'roadmap' ? 'Switch to satellite view' : 'Switch to map view'}
        >
          <Layers className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 rounded-full border border-border shadow-lg"
          onClick={fitAll}
          aria-label="Show all vehicles"
        >
          <LocateFixed className="h-5 w-5" />
        </Button>
        {/* Zoom right in on the selected vehicle — close enough to read which
            side of a site they are on, which "fit all" can never show. */}
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 rounded-full border border-border shadow-lg"
          disabled={!selectedId}
          onClick={() => {
            const vehicle = vehicles.find((v) => v.id === selectedId);
            if (!vehicle || !mapRef.current) return;
            mapRef.current.panTo({ lat: vehicle.lat, lng: vehicle.lng });
            mapRef.current.setZoom(18);
          }}
          aria-label="Zoom to the selected vehicle"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-11 w-11 rounded-full shadow-lg"
          onClick={() => navigate('/app/admin/drivers/new')}
          aria-label="Add a driver"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 rounded-full border border-border shadow-lg"
          onClick={() => navigate('/app/admin/codes')}
          aria-label="Drivers and codes"
        >
          <KeyRound className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 rounded-full border border-border shadow-lg"
          onClick={() => void refetch()}
          aria-label="Refresh vehicle positions"
        >
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Vehicle sheet */}
      <div className="absolute inset-x-0 bottom-0 z-[1000]">
        <div
          className="rounded-t-2xl border-t border-border bg-background/95 backdrop-blur"
          style={{ boxShadow: '0 -8px 24px -12px hsl(224 44% 11% / 0.25)' }}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((open) => !open)}
            className="flex w-full items-center gap-2.5 px-4 py-3"
            aria-expanded={sheetOpen}
          >
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left font-heading text-sm font-semibold">
              Vehicles
              <span className="telemetry ml-1.5 font-normal text-muted-foreground">
                {vehicles.length}
              </span>
            </span>
            {sheetOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {sheetOpen && (
            <div className="max-h-44 overflow-y-auto overscroll-contain px-3 pb-3">
              {loading && vehicles.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Loading your fleet…
                </p>
              )}

              {!loading && vehicles.length === 0 && (
                <div className="px-1 py-5 text-center">
                  <p className="text-sm font-medium text-foreground">No vehicles yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a connection code and share it with your driver.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => navigate('/app/admin/drivers/new')}
                  >
                    <Plus className="h-4 w-4" />
                    Add a driver
                  </Button>
                </div>
              )}

              <ul className="space-y-1.5">
                {vehicles.map((v) => {
                  const classes = STATUS_CLASSES[v.status];
                  return (
                    <li key={v.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => flyTo(v.lat, v.lng, v.id)}
                        className={cn(
                          'flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          selectedId === v.id
                            ? 'border-primary/50 bg-accent'
                            : 'border-transparent bg-card hover:bg-muted'
                        )}
                      >
                        <span
                          className="h-8 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: v.accent }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatLastSeen(v.lastSeen)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              classes.chip
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', classes.dot)} />
                            {STATUS_LABEL[v.status]}
                          </span>
                          {v.status === 'moving' && (
                            <p className="telemetry mt-0.5 text-xs font-semibold text-foreground">
                              {Math.round(v.speedKmh)} km/h
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Separate target: the row centres the map, this opens
                          the full driver record. Two intents, two controls —
                          no double-tap guessing. */}
                      <button
                        type="button"
                        onClick={() => navigate(`/app/admin/drivers/${v.id}`)}
                        aria-label={`Open ${v.name}'s details`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className="h-5 w-5" />
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
