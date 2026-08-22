import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import {
  CalendarDays,
  Camera,
  Car,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  ParkingCircle,
  Route as RouteIcon,
  SignalZero,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { getDriverAccent } from '@/lib/driverAccent';
import {
  allPoints,
  buildSegments,
  formatDuration,
  summarise,
  type Fix,
  type Segment,
} from '@/lib/tripSegments';
import { fetchDriverVisits, type StationVisit } from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

/** Local YYYY-MM-DD, so "today" means the manager's today, not UTC's. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Most recent first. The strip previously ran oldest-to-newest, which put
 * today off the right-hand edge — so it opened scrolled away from the day a
 * manager almost always wants.
 */
function recentDays(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });
}

function Stat({ icon: Icon, value, label }: { icon: typeof RouteIcon; value: string; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="telemetry mt-1 text-lg font-bold leading-none text-foreground">{value}</p>
    </div>
  );
}

/**
 * A driver's day, as a story rather than a scribble.
 *
 * Shared by the app and the website so both tell it identically. The layout
 * stacks on a phone and splits into map + timeline on a wide screen.
 *
 * The design follows what mature tracking timelines converged on: a raw
 * polyline answers "where did it go" but not "what did it do", so the day is
 * segmented into trips, stops and blackouts, and the list is the primary
 * interface — the map follows the list, not the other way round. Selecting a
 * row frames that segment, which is how you inspect one delivery without
 * losing the day around it.
 */
export default function DriverHistoryView({
  driverId,
  driverName,
}: {
  driverId: string;
  driverName: string;
}) {
  const { isDark } = useTheme();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [day, setDay] = useState<Date>(new Date());
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');

  const accent = getDriverAccent(driverId);
  const days = useMemo(() => recentDays(30), []);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    try {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);

      const [{ data, error }, visitRows] = await Promise.all([
        supabase
          .from('driver_location_history')
          .select('latitude, longitude, speed, accuracy, recorded_at')
          .eq('driver_id', driverId)
          .gte('recorded_at', start.toISOString())
          .lte('recorded_at', end.toISOString())
          .order('recorded_at', { ascending: true }),
        fetchDriverVisits(driverId, isoDay(day)).catch(() => [] as StationVisit[]),
      ]);

      if (error) throw error;
      setFixes((data ?? []) as Fix[]);
      setVisits(visitRows.filter((v) => v.visit_date === isoDay(day)));
    } catch (err) {
      console.error('[DriverHistoryView] load failed:', err);
      setFixes([]);
    } finally {
      setLoading(false);
    }
  }, [driverId, day]);

  useEffect(() => {
    void load();
  }, [load]);

  const segments = useMemo(() => buildSegments(fixes), [fixes]);
  const summary = useMemo(() => summarise(segments), [segments]);
  const trips = useMemo(
    () => segments.filter((s): s is Extract<Segment, { kind: 'trip' }> => s.kind === 'trip'),
    [segments]
  );

  // Frame the whole day, then re-frame when a segment is picked.
  useEffect(() => {
    if (!mapRef.current || segments.length === 0) return;
    const points = selected != null ? pointsOf(segments[selected]) : allPoints(segments);
    if (points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 48);
  }, [segments, selected]);

  const start = trips[0]?.path[0];
  const finish = trips[trips.length - 1]?.path.slice(-1)[0];

  return (
    <div className="flex h-full flex-col lg:grid lg:h-auto lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4">
      {/* ── Map ── */}
      <div className="relative h-[42vh] shrink-0 overflow-hidden border-b border-border lg:h-[620px] lg:rounded-xl lg:border">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: 6.5244, lng: 3.3792 }}
            zoom={12}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
              mapTypeId: mapType,
              styles: mapType === 'roadmap' ? getNavMapStyle(isDark) : undefined,
            }}
          >
            {/* Route. A casing stroke under the line keeps it legible over
                both pale roads and satellite imagery. */}
            {trips.map((trip, index) => {
              const globalIndex = segments.indexOf(trip);
              const dimmed = selected != null && selected !== globalIndex;
              return (
                <Polyline
                  key={`trip-${index}`}
                  path={trip.path}
                  options={{
                    strokeColor: dimmed ? '#94a3b8' : accent,
                    strokeOpacity: dimmed ? 0.35 : 0.95,
                    strokeWeight: dimmed ? 3 : 5,
                    zIndex: dimmed ? 1 : 3,
                  }}
                />
              );
            })}

            {/* Blackouts are drawn as a dashed straight line: the vehicle did
                travel between these points, but we have no idea how. */}
            {segments.map((segment, index) =>
              segment.kind === 'gap' && segment.from && segment.to ? (
                <Polyline
                  key={`gap-${index}`}
                  path={[segment.from, segment.to]}
                  options={{
                    strokeOpacity: 0,
                    zIndex: 2,
                    icons: [
                      {
                        icon: {
                          path: 'M 0,-1 0,1',
                          strokeOpacity: 0.9,
                          strokeColor: '#f59e0b',
                          strokeWeight: 2.5,
                          scale: 3,
                        },
                        offset: '0',
                        repeat: '14px',
                      },
                    ],
                  }}
                />
              ) : null
            )}

            {/* Stops, numbered in the order they happened */}
            {segments.map((segment, index) => {
              if (segment.kind !== 'stop') return null;
              const stopNumber = segments.slice(0, index).filter((s) => s.kind === 'stop').length + 1;
              return (
                <Marker
                  key={`stop-${index}`}
                  position={segment.at}
                  onClick={() => setSelected(index)}
                  zIndex={4}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: selected === index ? 13 : 10,
                    fillColor: '#ffffff',
                    fillOpacity: 1,
                    strokeColor: accent,
                    strokeWeight: 3,
                  }}
                  label={{
                    text: String(stopNumber),
                    color: '#111827',
                    fontSize: '10px',
                    fontWeight: '700',
                  }}
                />
              );
            })}

            {/* Station visits that happened on this day */}
            {visits.map((visit) =>
              visit.photo_lat != null && visit.photo_lng != null ? (
                <Marker
                  key={visit.id}
                  position={{ lat: visit.photo_lat, lng: visit.photo_lng }}
                  zIndex={5}
                  title="Station receipt"
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: '#0b8f4f',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                />
              ) : null
            )}

            {/* Start / end of the day */}
            {start && (
              <Marker
                position={start}
                zIndex={6}
                title="First movement"
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#16a34a',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                }}
              />
            )}
            {finish && (
              <Marker
                position={finish}
                zIndex={6}
                title="Last known position"
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#dc2626',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setMapType((t) => (t === 'roadmap' ? 'hybrid' : 'roadmap'))}
          className="absolute right-3 top-3 flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/95 px-2.5 text-xs font-semibold shadow-lg backdrop-blur"
        >
          <Layers className="h-4 w-4" />
          {mapType === 'roadmap' ? 'Satellite' : 'Map'}
        </button>

        {selected != null && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur"
          >
            Show whole day
          </button>
        )}
      </div>

      {/* ── Day picker, summary, timeline ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:h-[620px]">
        {/* Day strip — today first, scrolling back through the month, with a
            date picker for anything older. */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {days.map((d) => {
              const isSelected = isoDay(d) === isoDay(day);
              const isToday = isoDay(d) === isoDay(new Date());
              return (
                <button
                  key={isoDay(d)}
                  type="button"
                  onClick={() => setDay(d)}
                  className={cn(
                    'flex min-h-[52px] w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="text-[10px] font-medium uppercase">
                    {isToday ? 'Today' : format(d, 'EEE')}
                  </span>
                  <span className="telemetry text-sm font-bold">{format(d, 'd')}</span>
                  {!isToday && (
                    <span className="text-[9px] uppercase opacity-70">{format(d, 'MMM')}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Any date at all, for last month or last quarter */}
          <label
            className="relative flex h-[52px] w-12 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground"
            title="Pick any date"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="mt-0.5 text-[9px] font-semibold uppercase">Pick</span>
            <input
              type="date"
              max={isoDay(new Date())}
              value={isoDay(day)}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m, d] = e.target.value.split('-').map(Number);
                setDay(new Date(y, m - 1, d));
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {/* Summary */}
        <div className="px-3 pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {isoDay(day) === isoDay(new Date())
              ? 'Today'
              : format(day, 'EEEE d MMMM yyyy')}
          </p>
        </div>
        <div className="flex gap-2 px-3 py-3">
          <Stat icon={RouteIcon} label="Distance" value={`${summary.distanceKm.toFixed(1)} km`} />
          <Stat icon={Car} label="Driving" value={formatDuration(summary.drivingMinutes)} />
          <Stat icon={ParkingCircle} label="Stops" value={String(summary.stops)} />
        </div>

        {summary.darkMinutes > 0 && (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            <SignalZero className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-warning">
              Not reporting for {formatDuration(summary.darkMinutes)} of this day.
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading the day…
            </div>
          ) : segments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <MapPin className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No movement recorded</p>
              <p className="text-xs text-muted-foreground">
                {driverName} either did not go on duty, or the phone was not reporting.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-1.5 pl-6">
              {/* Spine */}
              <span
                className="absolute bottom-2 left-[9px] top-2 w-px bg-border"
                aria-hidden="true"
              />

              {segments.map((segment, index) => {
                const isSelected = selected === index;
                const stopNumber =
                  segment.kind === 'stop'
                    ? segments.slice(0, index).filter((s) => s.kind === 'stop').length + 1
                    : null;

                return (
                  <li key={index} className="relative">
                    <span
                      className={cn(
                        'absolute -left-[18px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-background',
                        segment.kind === 'trip'
                          ? 'bg-primary'
                          : segment.kind === 'stop'
                            ? 'bg-foreground'
                            : 'bg-warning'
                      )}
                      aria-hidden="true"
                    />

                    <button
                      type="button"
                      onClick={() => setSelected(isSelected ? null : index)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-accent'
                          : 'border-transparent bg-card hover:bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                          segment.kind === 'trip'
                            ? 'bg-primary/10 text-primary'
                            : segment.kind === 'stop'
                              ? 'bg-muted text-foreground'
                              : 'bg-warning/15 text-warning'
                        )}
                      >
                        {segment.kind === 'trip' ? (
                          <Navigation className="h-4 w-4" />
                        ) : segment.kind === 'stop' ? (
                          stopNumber
                        ) : (
                          <SignalZero className="h-4 w-4" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {segment.kind === 'trip'
                            ? `Drove ${segment.distanceKm.toFixed(1)} km`
                            : segment.kind === 'stop'
                              ? `Stopped ${formatDuration(segment.minutes)}`
                              : `No signal ${formatDuration(segment.minutes)}`}
                        </span>
                        <span className="telemetry block text-xs text-muted-foreground">
                          {format(segment.startedAt, 'HH:mm')} – {format(segment.endedAt, 'HH:mm')}
                          {segment.kind === 'trip' &&
                            ` · ${Math.round(segment.maxSpeedKmh)} km/h top`}
                        </span>
                      </span>

                      {segment.kind === 'trip' && (
                        <span className="telemetry shrink-0 text-xs text-muted-foreground">
                          {formatDuration(segment.minutes)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Station receipts collected that day */}
          {visits.length > 0 && (
            <div className="mt-4">
              <p className="eyebrow mb-2">Station receipts</p>
              <ul className="space-y-1.5">
                {visits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    {visit.photo_url ? (
                      <img
                        src={visit.photo_url}
                        alt="Receipt"
                        className="h-10 w-10 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                        <Camera className="h-4 w-4 text-warning" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {visit.status === 'completed' ? 'Receipt submitted' : 'Arrived, no receipt'}
                      </span>
                      <span className="telemetry block text-xs text-muted-foreground">
                        {format(new Date(visit.arrived_at), 'HH:mm')}
                        {visit.dwell_seconds != null && ` · ${visit.dwell_seconds}s stay`}
                      </span>
                    </span>
                    <Timer className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Points belonging to one segment, for framing the map on it. */
function pointsOf(segment: Segment) {
  if (segment.kind === 'trip') return segment.path;
  if (segment.kind === 'stop') return [segment.at];
  return [segment.from, segment.to].filter(Boolean) as { lat: number; lng: number }[];
}
