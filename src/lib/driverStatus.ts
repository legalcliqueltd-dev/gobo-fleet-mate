/**
 * One definition of "is this vehicle moving, parked, or gone?" so the map
 * markers, the fleet list and the summary counters can never disagree.
 */
export type VehicleStatus = 'moving' | 'idle' | 'offline';

/** No fix for this long and we stop claiming to know where the vehicle is. */
const OFFLINE_AFTER_MS = 10 * 60 * 1000;
/** Below this the GPS is almost certainly just jittering while parked. */
const MOVING_ABOVE_KMH = 5;

export function getVehicleStatus(
  speedKmh: number | null | undefined,
  lastSeenIso: string | null | undefined
): VehicleStatus {
  if (!lastSeenIso) return 'offline';

  const age = Date.now() - new Date(lastSeenIso).getTime();
  if (!Number.isFinite(age) || age > OFFLINE_AFTER_MS) return 'offline';

  return (speedKmh ?? 0) >= MOVING_ABOVE_KMH ? 'moving' : 'idle';
}

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  moving: 'Moving',
  idle: 'Parked',
  offline: 'Offline',
};

/** Tailwind token classes, so the palette stays theme-aware in dark mode. */
export const STATUS_CLASSES: Record<VehicleStatus, { dot: string; text: string; chip: string }> = {
  moving: { dot: 'bg-success', text: 'text-success', chip: 'bg-success/10 text-success' },
  idle: { dot: 'bg-warning', text: 'text-warning', chip: 'bg-warning/10 text-warning' },
  offline: {
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    chip: 'bg-muted text-muted-foreground',
  },
};

/** "just now" / "4 min ago" / "2 h ago" — compact enough for a list row. */
export function formatLastSeen(lastSeenIso: string | null | undefined): string {
  if (!lastSeenIso) return 'never';

  const seconds = Math.floor((Date.now() - new Date(lastSeenIso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return 'never';
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}
