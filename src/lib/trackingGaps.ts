/**
 * Tracking-gap detection.
 *
 * A driver whose phone is off, force-quit, or out of battery simply stops
 * producing fixes — which on a timeline looks identical to a quiet afternoon
 * parked up. That ambiguity is the problem: silence should be *visible*.
 *
 * These helpers turn a stream of location fixes into explicit gap spans that
 * the UI can render as breaks in the record, so a manager sees "no data for
 * 2 h 14 m" rather than nothing at all.
 *
 * Derived entirely from `driver_location_history` — no extra storage.
 */

export type Fix = { timestamp: string; latitude?: number; longitude?: number };

export type TrackingGap = {
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  /** Still ongoing — the last fix is old and nothing has arrived since. */
  open: boolean;
};

/**
 * Below this, a break is just normal jitter in the reporting interval (the app
 * sends roughly every 30 s, and throttling can stretch that). Above it, the
 * device genuinely stopped reporting.
 */
export const GAP_THRESHOLD_MINUTES = 12;

/**
 * Find every span where reporting stopped for longer than the threshold.
 * Fixes may arrive in any order; they are sorted before scanning.
 */
export function findTrackingGaps(
  fixes: Fix[],
  thresholdMinutes = GAP_THRESHOLD_MINUTES
): TrackingGap[] {
  if (fixes.length < 2) return [];

  const times = fixes
    .map((f) => new Date(f.timestamp).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const thresholdMs = thresholdMinutes * 60_000;
  const gaps: TrackingGap[] = [];

  for (let i = 1; i < times.length; i++) {
    const delta = times[i] - times[i - 1];
    if (delta > thresholdMs) {
      gaps.push({
        startedAt: new Date(times[i - 1]),
        endedAt: new Date(times[i]),
        minutes: Math.round(delta / 60_000),
        open: false,
      });
    }
  }

  return gaps;
}

/**
 * Is the driver dark *right now*? Reported separately from historical gaps
 * because an open gap is actionable — someone should be called.
 */
export function findOpenGap(
  fixes: Fix[],
  thresholdMinutes = GAP_THRESHOLD_MINUTES
): TrackingGap | null {
  if (fixes.length === 0) return null;

  const latest = Math.max(
    ...fixes.map((f) => new Date(f.timestamp).getTime()).filter((t) => Number.isFinite(t))
  );
  if (!Number.isFinite(latest)) return null;

  const elapsed = Date.now() - latest;
  if (elapsed <= thresholdMinutes * 60_000) return null;

  return {
    startedAt: new Date(latest),
    endedAt: new Date(),
    minutes: Math.round(elapsed / 60_000),
    open: true,
  };
}

/** "2 h 14 m" / "43 m" — compact enough for a timeline row. */
export function formatGapDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} m` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

/** Share of a window actually covered by tracking, 0-100. */
export function coveragePercent(gaps: TrackingGap[], windowMinutes: number): number {
  if (windowMinutes <= 0) return 100;
  const missing = gaps.reduce((sum, gap) => sum + gap.minutes, 0);
  return Math.max(0, Math.min(100, Math.round(((windowMinutes - missing) / windowMinutes) * 100)));
}

/**
 * Vehicle-motion check.
 *
 * Only the phone is tracked, so nothing can *prove* the vehicle arrived. What
 * the speed profile can show is whether the approach was plausibly driven: a
 * vehicle reaches sustained speeds a person on foot cannot. If the fastest
 * approach speed never exceeds a brisk walk, the arrival is worth flagging for
 * the manager to look at — not treated as proof of cheating.
 *
 * `speeds` are km/h over the minutes leading up to the arrival.
 */
export const WALKING_MAX_KMH = 8;

export function checkVehicleMotion(speedsKmh: (number | null | undefined)[]): {
  looksDriven: boolean;
  peakKmh: number;
  reason: string | null;
} {
  const valid = speedsKmh
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s >= 0 && s < 250);

  if (valid.length < 3) {
    return { looksDriven: true, peakKmh: 0, reason: null }; // too little data to judge
  }

  const peakKmh = Math.round(Math.max(...valid));
  if (peakKmh <= WALKING_MAX_KMH) {
    return {
      looksDriven: false,
      peakKmh,
      reason: `Approached on foot — top speed ${peakKmh} km/h`,
    };
  }

  return { looksDriven: true, peakKmh, reason: null };
}
