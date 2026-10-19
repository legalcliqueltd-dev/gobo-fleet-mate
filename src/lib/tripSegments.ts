import { distanceMeters } from '@/integrations/supabase/stations';
import { GAP_THRESHOLD_MINUTES } from '@/lib/trackingGaps';

export type Fix = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  recorded_at: string;
};

export type Point = { lat: number; lng: number };

export type Segment =
  | {
      kind: 'trip';
      startedAt: Date;
      endedAt: Date;
      minutes: number;
      distanceKm: number;
      maxSpeedKmh: number;
      path: Point[];
    }
  | {
      kind: 'stop';
      startedAt: Date;
      endedAt: Date;
      minutes: number;
      at: Point;
      /** Minutes inside this stop with no fixes at all (phone asleep or off). */
      quietMinutes: number;
    }
  | {
      kind: 'gap';
      startedAt: Date;
      endedAt: Date;
      minutes: number;
      from: Point | null;
      to: Point | null;
    };

/**
 * Turn a day of raw GPS fixes into a readable story: stayed here, drove
 * there, went dark in between.
 *
 * STAY-POINT DETECTION, the way phone timelines do it (Google's, Life360's).
 * The previous version called something a stop only while every fix stayed
 * within 60 m of the FIRST fix, and called any 12-minute silence "No signal".
 * Indoors a phone wanders 40–90 m with no one moving, so one evening at home
 * came out as five numbered "stops", a fake 0.2 km "drive" at 52 km/h, and
 * a no-signal gap every time the screen went off. Now:
 *
 *   stay — fixes within STAY_RADIUS_M of their running centre, lasting at
 *          least STAY_MIN_MINUTES. A silence that starts and ends at the same
 *          place is part of the stay: the phone was asleep there.
 *   trip — movement between stays, kept only if it actually went somewhere
 *          (MIN_TRIP_M from where it started). Smaller wobble folds back into
 *          the stay, and two stays at the same place become one.
 *   gap  — a silence after which the driver was somewhere else. Only this is
 *          "no signal": we know they moved and not how.
 */

/** Indoor GPS wanders this far with nobody moving. */
const STAY_RADIUS_M = 120;
/** Shorter pauses are junctions and traffic, not places. */
const STAY_MIN_MINUTES = 5;
/** A "trip" that never got this far from where it began was GPS wobble. */
const MIN_TRIP_M = 250;
/** Worse than this and the fix is noise that would invent phantom travel. */
const MAX_ACCURACY_M = 100;
/** Fixes looser than this count for position but not for distance or speed. */
const MEASURE_ACCURACY_M = 50;
/** Implied speeds above this are teleports between bad fixes. */
const MAX_PLAUSIBLE_KMH = 180;

const toPoint = (f: Fix): Point => ({ lat: f.latitude, lng: f.longitude });
const timeOf = (f: Fix) => new Date(f.recorded_at).getTime();
const minutesBetween = (a: number, b: number) => Math.max(0, (b - a) / 60000);

function centroid(fixes: Fix[]): Point {
  const lat = fixes.reduce((s, f) => s + f.latitude, 0) / fixes.length;
  const lng = fixes.reduce((s, f) => s + f.longitude, 0) / fixes.length;
  return { lat, lng };
}

/** Same instant, same place: the same fix uploaded twice. Kept once. */
function clean(raw: Fix[]): Fix[] {
  const seen = new Set<string>();
  return raw
    .filter(
      (f) =>
        Number.isFinite(f.latitude) &&
        Number.isFinite(f.longitude) &&
        Number.isFinite(timeOf(f)) &&
        (f.accuracy == null || f.accuracy <= MAX_ACCURACY_M)
    )
    .filter((f) => {
      const key = `${timeOf(f)}:${f.latitude.toFixed(5)}:${f.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => timeOf(a) - timeOf(b));
}

type Stay = { first: number; last: number; at: Point };

/** Find every place the driver stayed: contiguous runs inside the radius. */
function findStays(fixes: Fix[]): Stay[] {
  const stays: Stay[] = [];
  let i = 0;
  while (i < fixes.length) {
    let j = i;
    let members = [fixes[i]];
    let centre = toPoint(fixes[i]);
    while (j + 1 < fixes.length && distanceMeters(centre, toPoint(fixes[j + 1])) <= STAY_RADIUS_M) {
      j += 1;
      members = fixes.slice(i, j + 1);
      centre = centroid(members);
    }
    if (minutesBetween(timeOf(fixes[i]), timeOf(fixes[j])) >= STAY_MIN_MINUTES) {
      stays.push({ first: i, last: j, at: centre });
      i = j + 1;
    } else {
      i += 1;
    }
  }

  // Two stays at the same place with only wobble between them are one stay.
  const merged: Stay[] = [];
  for (const stay of stays) {
    const prev = merged[merged.length - 1];
    if (prev && distanceMeters(prev.at, stay.at) <= STAY_RADIUS_M) {
      const between = fixes.slice(prev.last, stay.first + 1);
      const wentAway = between.some((f) => distanceMeters(prev.at, toPoint(f)) > MIN_TRIP_M);
      if (!wentAway) {
        prev.last = stay.last;
        prev.at = centroid(fixes.slice(prev.first, prev.last + 1));
        continue;
      }
    }
    merged.push({ ...stay });
  }
  return merged;
}

function measureTrip(path: Fix[]) {
  let distanceKm = 0;
  let maxSpeedKmh = 0;
  const good = path.filter((f) => f.accuracy == null || f.accuracy <= MEASURE_ACCURACY_M);
  for (let k = 1; k < good.length; k++) {
    const meters = distanceMeters(toPoint(good[k - 1]), toPoint(good[k]));
    const seconds = (timeOf(good[k]) - timeOf(good[k - 1])) / 1000;
    if (seconds <= 0) continue;
    const kmh = (meters / seconds) * 3.6;
    if (kmh > MAX_PLAUSIBLE_KMH) continue; // a jump between two bad fixes
    distanceKm += meters / 1000;
    // Speed over a sensible stretch; a 2-second hop amplifies jitter.
    if (seconds >= 15) maxSpeedKmh = Math.max(maxSpeedKmh, kmh);
  }
  return { distanceKm, maxSpeedKmh };
}

export function buildSegments(rawFixes: Fix[]): Segment[] {
  const fixes = clean(rawFixes);
  if (fixes.length < 2) return [];

  const stays = findStays(fixes);
  const segments: Segment[] = [];
  const gapMs = GAP_THRESHOLD_MINUTES * 60_000;

  const pushStay = (stay: Stay) => {
    const members = fixes.slice(stay.first, stay.last + 1);
    let quiet = 0;
    for (let k = 1; k < members.length; k++) {
      const dt = timeOf(members[k]) - timeOf(members[k - 1]);
      if (dt > gapMs) quiet += dt / 60000;
    }
    const start = timeOf(members[0]);
    const end = timeOf(members[members.length - 1]);
    segments.push({
      kind: 'stop',
      startedAt: new Date(start),
      endedAt: new Date(end),
      minutes: minutesBetween(start, end),
      at: stay.at,
      quietMinutes: Math.round(quiet),
    });
  };

  /**
   * Movement from fixes[a] to fixes[b] (inclusive). Split at silences; each
   * piece is a trip if it went somewhere, a gap if the silence moved him.
   */
  const pushMovement = (a: number, b: number) => {
    if (b <= a) return;
    let runStart = a;
    const closeRun = (end: number) => {
      const run = fixes.slice(runStart, end + 1);
      if (run.length < 2) return;
      const origin = toPoint(run[0]);
      const reach = Math.max(...run.map((f) => distanceMeters(origin, toPoint(f))));
      if (reach < MIN_TRIP_M) return; // wobble, not a journey
      const { distanceKm, maxSpeedKmh } = measureTrip(run);
      // Draw the line through fixes good enough to measure with. A loose fix
      // mid-trip is what pulled the route out into a spike and back again;
      // the loose ones still count for timing, just not for the drawing.
      const drawable = run.filter((f) => f.accuracy == null || f.accuracy <= MEASURE_ACCURACY_M);
      const drawn = drawable.length >= 2 ? drawable : run;
      const start = timeOf(run[0]);
      const finish = timeOf(run[run.length - 1]);
      segments.push({
        kind: 'trip',
        startedAt: new Date(start),
        endedAt: new Date(finish),
        minutes: minutesBetween(start, finish),
        distanceKm,
        maxSpeedKmh,
        path: drawn.map(toPoint),
      });
    };

    for (let k = a + 1; k <= b; k++) {
      const dt = timeOf(fixes[k]) - timeOf(fixes[k - 1]);
      if (dt <= gapMs) continue;
      closeRun(k - 1);
      const from = toPoint(fixes[k - 1]);
      const to = toPoint(fixes[k]);
      if (distanceMeters(from, to) > STAY_RADIUS_M) {
        segments.push({
          kind: 'gap',
          startedAt: new Date(timeOf(fixes[k - 1])),
          endedAt: new Date(timeOf(fixes[k])),
          minutes: Math.round(dt / 60000),
          from,
          to,
        });
      }
      runStart = k;
    }
    closeRun(b);
  };

  if (stays.length === 0) {
    pushMovement(0, fixes.length - 1);
    return segments;
  }

  pushMovement(0, stays[0].first);
  stays.forEach((stay, index) => {
    pushStay(stay);
    const next = stays[index + 1];
    pushMovement(stay.last, next ? next.first : fixes.length - 1);
  });

  return joinTripsToStops(segments);
}

/**
 * Pin each drive's ends to the stops either side, so the day reads as one
 * connected path — stop, drive, stop. A drive's own first and last fixes sit
 * near the stop, not on it (and a loose one is left out of the drawing), so
 * the line used to begin or end a few dozen metres short of the stop's dot
 * and looked broken.
 */
function joinTripsToStops(segments: Segment[]): Segment[] {
  return segments.map((segment, index) => {
    if (segment.kind !== 'trip') return segment;
    const before = segments[index - 1];
    const after = segments[index + 1];
    const path = [...segment.path];
    if (before?.kind === 'stop') path.unshift(before.at);
    if (after?.kind === 'stop') path.push(after.at);
    return { ...segment, path };
  });
}

export type DaySummary = {
  distanceKm: number;
  drivingMinutes: number;
  stoppedMinutes: number;
  darkMinutes: number;
  stops: number;
  trips: number;
  maxSpeedKmh: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
};

export function summarise(segments: Segment[]): DaySummary {
  const trips = segments.filter((s): s is Extract<Segment, { kind: 'trip' }> => s.kind === 'trip');
  const stops = segments.filter((s) => s.kind === 'stop');
  const gaps = segments.filter((s) => s.kind === 'gap');

  return {
    distanceKm: trips.reduce((sum, t) => sum + t.distanceKm, 0),
    drivingMinutes: trips.reduce((sum, t) => sum + t.minutes, 0),
    stoppedMinutes: stops.reduce((sum, s) => sum + s.minutes, 0),
    darkMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0),
    stops: stops.length,
    trips: trips.length,
    maxSpeedKmh: trips.reduce((max, t) => Math.max(max, t.maxSpeedKmh), 0),
    firstSeen: segments.length ? segments[0].startedAt : null,
    lastSeen: segments.length ? segments[segments.length - 1].endedAt : null,
  };
}

/** "1 h 12 m" / "43 m" — compact enough for a timeline row. */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  // "min", never "m". These durations sit directly beside distances in km, and
  // "2 m" next to "1.0 km" reads as two metres.
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Every point in the day, for fitting the map to the whole route. */
export function allPoints(segments: Segment[]): Point[] {
  const points: Point[] = [];
  segments.forEach((segment) => {
    if (segment.kind === 'trip') points.push(...segment.path);
    else if (segment.kind === 'stop') points.push(segment.at);
    else {
      if (segment.from) points.push(segment.from);
      if (segment.to) points.push(segment.to);
    }
  });
  return points;
}
