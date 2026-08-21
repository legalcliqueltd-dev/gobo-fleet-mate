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
 * Turn a day of raw GPS fixes into a readable story: drove here, stopped
 * there, went dark in between.
 *
 * A day's history drawn as one continuous polyline is close to useless — it
 * shows where the vehicle has been but not what it *did*, and every parked
 * hour looks identical to a moment in traffic. Every serious tracking
 * timeline (Google's, Life360's, Uber's trip list) segments instead, and that
 * is what makes a day scannable in seconds.
 *
 * Three classifications, in priority order:
 *   gap  — no fixes for longer than the reporting threshold; the phone was
 *          off, dead, or force-quit. Recorded explicitly so silence is
 *          visible rather than being mistaken for a long stop.
 *   stop — fixes clustered within STOP_RADIUS_M for at least STOP_MIN_MINUTES.
 *   trip — everything else.
 */

/** Below this speed a vehicle is not meaningfully travelling. */
const MOVING_SPEED_KMH = 5;
/** Fixes staying inside this radius are the same place, not a short journey. */
const STOP_RADIUS_M = 60;
/** Shorter pauses are traffic lights and junctions, not stops worth listing. */
const STOP_MIN_MINUTES = 3;
/** Worse than this and the fix is noise that would invent phantom travel. */
const MAX_ACCURACY_M = 100;

const toPoint = (f: Fix): Point => ({ lat: f.latitude, lng: f.longitude });
const minutesBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60000);

export function buildSegments(rawFixes: Fix[]): Segment[] {
  const fixes = rawFixes
    .filter(
      (f) =>
        Number.isFinite(f.latitude) &&
        Number.isFinite(f.longitude) &&
        (f.accuracy == null || f.accuracy <= MAX_ACCURACY_M)
    )
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  if (fixes.length < 2) return [];

  const segments: Segment[] = [];
  let bucket: Fix[] = [fixes[0]];

  /** Close the working bucket as either a stop or a trip. */
  const flush = () => {
    if (bucket.length === 0) return;

    const startedAt = new Date(bucket[0].recorded_at);
    const endedAt = new Date(bucket[bucket.length - 1].recorded_at);
    const minutes = minutesBetween(startedAt, endedAt);

    // Did it stay put? Compare the span of the bucket, not consecutive hops:
    // GPS jitter accumulates into fictitious distance otherwise.
    const anchor = toPoint(bucket[0]);
    const spread = Math.max(...bucket.map((f) => distanceMeters(anchor, toPoint(f))));

    if (spread <= STOP_RADIUS_M) {
      if (minutes >= STOP_MIN_MINUTES) {
        segments.push({ kind: 'stop', startedAt, endedAt, minutes, at: anchor });
      }
      // Briefer than the threshold: a junction, not a stop. Dropped.
      bucket = [];
      return;
    }

    let distanceKm = 0;
    for (let i = 1; i < bucket.length; i++) {
      distanceKm += distanceMeters(toPoint(bucket[i - 1]), toPoint(bucket[i])) / 1000;
    }

    segments.push({
      kind: 'trip',
      startedAt,
      endedAt,
      minutes,
      distanceKm,
      maxSpeedKmh: Math.max(0, ...bucket.map((f) => f.speed ?? 0)),
      path: bucket.map(toPoint),
    });
    bucket = [];
  };

  for (let i = 1; i < fixes.length; i++) {
    const previous = fixes[i - 1];
    const current = fixes[i];
    const elapsed = minutesBetween(new Date(previous.recorded_at), new Date(current.recorded_at));

    if (elapsed > GAP_THRESHOLD_MINUTES) {
      flush();
      segments.push({
        kind: 'gap',
        startedAt: new Date(previous.recorded_at),
        endedAt: new Date(current.recorded_at),
        minutes: Math.round(elapsed),
        from: toPoint(previous),
        to: toPoint(current),
      });
      bucket = [current];
      continue;
    }

    // A run of slow, tightly-clustered fixes ends the current trip.
    const movingNow = (current.speed ?? 0) >= MOVING_SPEED_KMH;
    const anchor = bucket.length ? toPoint(bucket[0]) : toPoint(current);
    const drifted = distanceMeters(anchor, toPoint(current)) > STOP_RADIUS_M;
    const bucketIsStationary = bucket.length > 1 && !drifted;

    if (movingNow && bucketIsStationary) {
      flush();
      bucket = [previous, current];
    } else {
      bucket.push(current);
    }
  }

  flush();
  return segments;
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
  if (rounded < 60) return `${rounded} m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${rest} m` : `${hours} h`;
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
