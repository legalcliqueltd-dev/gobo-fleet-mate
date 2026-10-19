import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import {
  CalendarDays,
  Camera,
  Car,
  Layers,
  Loader2,
  MapPin,
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
import { snapToRoads } from '@/lib/snapToRoads';
import { cn } from '@/lib/utils';

/**
 * Fixed for the life of the screen. An inline object here is a NEW centre on
 * every render, which the map library re-applies — so every re-render (a row
 * tapped, a day loaded) threw the map back to Lagos after it had been framed
 * on the driver's day.
 */
const INITIAL_CENTER = { lat: 6.5244, lng: 3.3792 };

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
  // Bumped when a map instance loads. The day's data usually arrives first,
  // so without this the framing ran with no map and never again — leaving
  // the map on its default city instead of the driver's day.
  const [mapGen, setMapGen] = useState(0);
  const framedRef = useRef<string | null>(null);

  const accent = getDriverAccent(driverId);
  const days = useMemo(() => recentDays(30), []);

  /** `silent` is the live refresh: no spinner, the selection is kept. */
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setSelected(null);
    }
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
      if (!silent) setFixes([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [driverId, day]);

  // Today is still happening: pick up new points every minute. Without this
  // the screen showed the day as it was when it was opened, so a driver who
  // had been reporting for half an hour looked like they had stopped.
  useEffect(() => {
    if (isoDay(day) !== isoDay(new Date())) return;
    const timer = setInterval(() => void load(true), 60_000);
    return () => clearInterval(timer);
  }, [day, load]);

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
    if (mapGen === 0 || !mapRef.current || segments.length === 0) return;
    // A live refresh must not yank the map away from where the manager is
    // looking; reframe only when what is being looked at changed.
    const frameKey = `${isoDay(day)}|${selected ?? 'all'}|${mapGen}`;
    if (framedRef.current === frameKey) return;
    framedRef.current = frameKey;
    const points = selected != null ? pointsOf(segments[selected]) : allPoints(segments);
    if (points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    const map = mapRef.current;
    map.fitBounds(bounds, 48);
    // One place (a stop) fits to a single point, and Google then zooms to its
    // limit — blank tiles and a lone dot. Street level is as close as it gets.
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
    });
  }, [segments, selected, mapGen, day]);

  const dayPoints = useMemo(() => allPoints(segments), [segments]);

  // The recorded points themselves, as faint dots: proof the phone was
  // reporting even where nothing moved. The selected row's points, or the
  // whole day while that stays light enough to draw.
  // "Where were they at 14:32?" — a time slider over the day. The answer
  // comes from the segments, not the raw fix: inside a stop it is the stop
  // itself (a raw fix there is just indoor drift); on a drive it is the
  // route, interpolated between the fixes either side of that moment.
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const timedFixes = useMemo(
    () =>
      fixes
        .filter((f) => f.accuracy == null || f.accuracy <= 100)
        .map((f) => ({ ...f, t: new Date(f.recorded_at).getTime() }))
        .filter((f) => Number.isFinite(f.t))
        .sort((a, b) => a.t - b.t),
    [fixes]
  );
  const dayStart = timedFixes[0]?.t ?? null;
  const dayEnd = timedFixes[timedFixes.length - 1]?.t ?? null;

  // A new day starts with the slider off.
  useEffect(() => setScrubAt(null), [day]);

  const scrub = useMemo(() => {
    if (scrubAt == null || timedFixes.length === 0) return null;
    const segment = segments.find(
      (seg) => scrubAt >= seg.startedAt.getTime() && scrubAt <= seg.endedAt.getTime()
    );
    if (segment?.kind === 'stop') {
      return {
        at: segment.at,
        label: `Stopped since ${format(segment.startedAt, 'HH:mm')}`,
      };
    }
    if (segment?.kind === 'gap') {
      return {
        at: segment.from ?? segment.to,
        label: `No signal (${format(segment.startedAt, 'HH:mm')} – ${format(segment.endedAt, 'HH:mm')})`,
      };
    }
    // On a drive, or between segments: interpolate between the two fixes
    // either side of the chosen moment.
    let i = timedFixes.findIndex((f) => f.t >= scrubAt);
    if (i === -1) i = timedFixes.length - 1;
    const after = timedFixes[i];
    const before = timedFixes[Math.max(0, i - 1)];
    const span = after.t - before.t;
    const k = span > 0 ? Math.min(1, Math.max(0, (scrubAt - before.t) / span)) : 1;
    const at = {
      lat: before.latitude + (after.latitude - before.latitude) * k,
      lng: before.longitude + (after.longitude - before.longitude) * k,
    };
    const speed = Math.round(after.speed ?? 0);
    return {
      at: at as { lat: number; lng: number } | null,
      label: segment?.kind === 'trip' ? `Driving${speed >= 3 ? ` · ${speed} km/h` : ''}` : 'Moving',
    };
  }, [scrubAt, timedFixes, segments]);

  // Follow the marker as the slider moves, without changing the zoom.
  useEffect(() => {
    if (scrub?.at && mapRef.current) mapRef.current.panTo(scrub.at);
  }, [scrub?.at]);

  const breadcrumbs = useMemo(() => {
    const usable = fixes.filter((f) => f.accuracy == null || f.accuracy <= 100);
    // Only for the row being inspected. Across the whole day they were
    // clutter; for one stop they are the evidence behind it.
    const segment = selected != null ? segments[selected] : null;
    if (!segment) return [];
    const scoped = usable.filter((f) => {
      const t = new Date(f.recorded_at).getTime();
      return t >= segment.startedAt.getTime() && t <= segment.endedAt.getTime();
    });
    return scoped.length <= 400 ? scoped : [];
  }, [fixes, segments, selected]);
  // Drives drawn along the roads they used. Raw first, snapped when the
  // matcher answers; the raw fixes themselves are never changed.
  const [snapped, setSnapped] = useState<Record<number, { lat: number; lng: number }[]>>({});
  useEffect(() => {
    let cancelled = false;
    setSnapped({});
    trips.forEach((trip) => {
      // A drive still in progress changes shape with every refresh; snapping
      // it each minute would be a paid request a minute. It stays raw until
      // the driver stops, then snaps once.
      const lastSegment = segments[segments.length - 1];
      const inProgress =
        isoDay(day) === isoDay(new Date()) &&
        lastSegment === trip &&
        Date.now() - trip.endedAt.getTime() < 10 * 60_000;
      if (inProgress) return;
      const key = trip.startedAt.getTime();
      void snapToRoads(trip.path).then((path) => {
        if (!cancelled) setSnapped((prev) => ({ ...prev, [key]: path }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [trips, segments, day]);

  // One route colour, chosen for the ground it sits on: neon on the dark
  // map and on satellite, navy on the light map.
  const routeColor = isDark || mapType === 'hybrid' ? '#00ff39' : '#000738';
  const isToday = isoDay(day) === isoDay(new Date());

  const start = dayPoints[0];
  const finish = dayPoints.length > 1 ? dayPoints[dayPoints.length - 1] : undefined;

  return (
    // On a phone this scrolls as ONE column. Pinning it to the viewport meant
    // the map took 52vh, the date strip, stats and warning took the rest, and
    // the timeline — the entire reason for the page — was left a ~45px slot
    // showing half a row. Desktop keeps the fixed two-pane below, where there
    // is genuinely room for both.
    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4">
      {/* ── Map ── */}
      {/* Map and its time slider are one column on a wide screen. */}
      <div className="flex shrink-0 flex-col">
      <div
        className="relative h-[52vh] min-h-[260px] shrink-0 overflow-hidden lg:h-[600px] lg:min-h-0 lg:rounded-xl lg:border lg:border-border"
        // The sheet below overlaps the map by 24px on a phone. The map stops
        // short of that strip so Google's logo and terms stay visible (they
        // must), and the strip takes the map's own ground colour so the
        // sheet's rounded corners still read as sitting on the map.
        style={{ backgroundColor: isDark || mapType === 'hybrid' ? '#111927' : '#edf0f4' }}
      >
        {isLoaded ? (
          <GoogleMap
            mapContainerClassName="h-[calc(100%-24px)] w-full lg:h-full"
            center={INITIAL_CENTER}
            zoom={12}
            onLoad={(map) => {
              mapRef.current = map;
              setMapGen((g) => g + 1);
            }}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
              mapTypeId: mapType,
              styles: mapType === 'roadmap' ? getNavMapStyle(isDark) : undefined,
            }}
          >
            {/* Route: one clean line per drive, in one colour — no casing, no
                arrows. The order is the timeline's job; the map just shows
                the path. A selected drive stays bright and the rest fade. */}
            {trips.map((trip, index) => {
              const globalIndex = segments.indexOf(trip);
              const dimmed = selected != null && selected !== globalIndex;
              return (
                <Polyline
                  key={`trip-${index}`}
                  path={snapped[trip.startedAt.getTime()] ?? trip.path}
                  onClick={() => setSelected(globalIndex)}
                  options={{
                    strokeColor: routeColor,
                    strokeOpacity: dimmed ? 0.3 : 1,
                    strokeWeight: 4,
                    zIndex: dimmed ? 2 : 3,
                  }}
                />
              );
            })}

            {/* Blackouts are a dotted straight line: the vehicle did travel
                between these points, but we have no idea how. */}
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
                          path: google.maps.SymbolPath.CIRCLE,
                          fillColor: '#ffbf0b',
                          fillOpacity: 1,
                          strokeWeight: 0,
                          scale: 2,
                        },
                        offset: '0',
                        repeat: '10px',
                      },
                    ],
                  }}
                />
              ) : null
            )}

            {/* Stops: plain dots. Numbers on the map read as a puzzle — the
                timeline already says what happened in what order, and a
                selected row lights its own dot. */}
            {segments.map((segment, index) => {
              if (segment.kind !== 'stop') return null;
              const isSelected = selected === index;
              return (
                <Marker
                  key={`stop-${index}`}
                  position={segment.at}
                  onClick={() => setSelected(index)}
                  zIndex={isSelected ? 6 : 4}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isSelected ? 8 : 5,
                    fillColor: '#ffffff',
                    fillOpacity: 1,
                    strokeColor: routeColor,
                    strokeWeight: isSelected ? 3 : 2,
                  }}
                />
              );
            })}

            {scrub?.at && (
              <Marker
                position={scrub.at}
                zIndex={20}
                clickable={false}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: '#00ff39',
                  fillOpacity: 1,
                  strokeColor: '#000738',
                  strokeWeight: 4,
                }}
              />
            )}

            {breadcrumbs.map((f, i) => (
              <Marker
                key={`fix-${i}`}
                position={{ lat: f.latitude, lng: f.longitude }}
                clickable={false}
                zIndex={1}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 2.5,
                  fillColor: routeColor,
                  fillOpacity: 0.45,
                  strokeWeight: 0,
                }}
              />
            ))}

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
                    fillColor: '#00ff39',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                />
              ) : null
            )}

            {/* Start: a small hollow dot. Last seen: a solid dot with a soft
                halo — the two markers every tracker uses. */}
            {start && (
              <Marker
                position={start}
                zIndex={7}
                title="Start of the day"
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 5,
                  fillColor: isDark || mapType === 'hybrid' ? '#000738' : '#ffffff',
                  fillOpacity: 1,
                  strokeColor: routeColor,
                  strokeWeight: 2.5,
                }}
              />
            )}
            {finish && (
              <>
                <Marker
                  position={finish}
                  zIndex={8}
                  clickable={false}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 16,
                    fillColor: routeColor,
                    fillOpacity: 0.18,
                    strokeWeight: 0,
                  }}
                />
                <Marker
                  position={finish}
                  zIndex={9}
                  title={isToday ? 'Last seen' : 'End of the day'}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6.5,
                    fillColor: routeColor,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2.5,
                  }}
                />
              </>
            )}
          </GoogleMap>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* The headline, on the map, the way a tracker leads with its number.
            A soft navy scrim keeps it readable over any map underneath. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#000738]/85 via-[#000738]/40 to-transparent"
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute left-4 top-3 text-white">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
            {isToday ? 'Today' : format(day, 'EEE d MMM')}
          </p>
          <p className="telemetry font-heading text-4xl font-extrabold leading-tight">
            {summary.distanceKm.toFixed(1)} km
          </p>
          <p className="text-xs text-white/75">
            {formatDuration(summary.drivingMinutes)} driving · {summary.stops}{' '}
            {summary.stops === 1 ? 'stop' : 'stops'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMapType((t) => (t === 'roadmap' ? 'hybrid' : 'roadmap'))}
          aria-label={mapType === 'roadmap' ? 'Satellite view' : 'Map view'}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur"
        >
          <Layers className="h-4 w-4" />
        </button>

        {selected != null && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute bottom-9 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur lg:bottom-3"
          >
            Show whole day
          </button>
        )}

      </div>

      {/* Where were they at… — drag to any moment of the day. */}
      {dayStart != null && dayEnd != null && dayEnd > dayStart && (
        <div className="relative z-10 -mt-6 rounded-t-3xl bg-background px-4 pb-2 pt-2.5 lg:mt-0 lg:rounded-none lg:px-1">
          <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-muted lg:hidden" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <span className="telemetry w-11 shrink-0 text-sm font-bold">
              {format(new Date(scrubAt ?? dayEnd), 'HH:mm')}
            </span>
            <input
              type="range"
              min={dayStart}
              max={dayEnd}
              step={30_000}
              value={scrubAt ?? dayEnd}
              onChange={(e) => setScrubAt(Number(e.target.value))}
              aria-label="Where were they at this time"
              className="h-2 min-w-0 flex-1 cursor-pointer accent-[#00ff39]"
            />
            {scrubAt != null && (
              <button
                type="button"
                onClick={() => setScrubAt(null)}
                className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {scrub ? scrub.label : 'Drag to see where they were at any time'}
          </p>
        </div>
      )}

      </div>

      {/* ── Day picker, summary, timeline ── */}
      <div className="flex flex-col lg:h-[620px] lg:min-h-0">
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

        {summary.darkMinutes > 0 && (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            <SignalZero className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-warning">
              Not reporting for {formatDuration(summary.darkMinutes)} of this day.
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="px-3 pb-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
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
            // The More-sheet row, on a spine: tile, one bold line, one muted
            // line. A stay reads as a place you were, a trip as a journey
            // between two of them — the way a phone's own timeline reads.
            <ol className="relative">
              <span
                className="absolute bottom-6 left-[22px] top-6 w-px bg-border"
                aria-hidden="true"
              />

              {segments.map((segment, index) => {
                const isSelected = selected === index;
                const Icon =
                  segment.kind === 'trip' ? Car : segment.kind === 'stop' ? MapPin : SignalZero;
                const title =
                  segment.kind === 'trip'
                    ? `Drove ${segment.distanceKm.toFixed(1)} km`
                    : segment.kind === 'stop'
                      ? `Stopped · ${formatDuration(segment.minutes)}`
                      : `No signal · ${formatDuration(segment.minutes)}`;
                const range = `${format(segment.startedAt, 'HH:mm')} – ${format(segment.endedAt, 'HH:mm')}`;
                const note =
                  segment.kind === 'trip'
                    ? `${range} · ${formatDuration(segment.minutes)}${
                        segment.maxSpeedKmh >= 1 ? ` · top ${Math.round(segment.maxSpeedKmh)} km/h` : ''
                      }`
                    : segment.kind === 'stop'
                      ? `${range}${segment.quietMinutes >= 30 ? ` · no updates for ${formatDuration(segment.quietMinutes)}` : ''}`
                      : `${range} · moved while the phone was silent`;

                return (
                  <li key={index} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelected(isSelected ? null : index)}
                      className={cn(
                        'relative flex min-h-[56px] w-full items-center gap-3.5 rounded-xl px-0.5 py-2 text-left transition-colors active:bg-muted',
                        isSelected && 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 ring-background',
                          segment.kind === 'gap' ? 'bg-warning/15' : 'bg-accent'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px]',
                            segment.kind === 'gap' ? 'text-warning' : 'text-accent-foreground'
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{title}</span>
                        <span className="telemetry block truncate text-xs text-muted-foreground">{note}</span>
                      </span>
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
