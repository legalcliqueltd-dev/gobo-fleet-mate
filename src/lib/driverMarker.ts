import type { VehicleStatus } from '@/lib/driverStatus';

/**
 * Vehicle markers for the manager's maps.
 *
 * A plain dot told you a vehicle was somewhere; it did not tell you WHICH
 * vehicle without reading the label beside it. A car silhouette in the
 * driver's own colour is identifiable at a glance across a whole city, which
 * is the actual job of this marker.
 *
 * Two facts have to survive in one small shape:
 *   colour → WHO   (the driver's deterministic accent, stable forever)
 *   ring   → HOW   (moving / parked / offline)
 *
 * Deliberately small. A marker large enough to be pretty is large enough to
 * bury the road under it, and on a busy fleet the map becomes unreadable.
 */

/** Chunky car silhouette on a 24x24 grid — legible down to ~14px. */
const CAR_PATH =
  'M18.9 6C18.7 5.4 18.2 5 17.5 5h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6zM6.5 16c-.8 0-1.5-.7-1.5-1.5S5.7 13 6.5 13 8 13.7 8 14.5 7.3 16 6.5 16zm11 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z';

const STATUS_RING: Record<VehicleStatus, string> = {
  moving: '#22c55e',
  idle: '#f59e0b',
  offline: '#9ca3af',
};

export type DriverIcon = {
  url: string;
  size: number;
  anchor: number;
  labelY: number;
};

/**
 * @param accent  the driver's colour, from getDriverAccent
 * @param status  drives the ring only, never the body — so a parked vehicle is
 *                still recognisably the same driver as when it was moving
 */
export function driverMarkerIcon(
  accent: string,
  status: VehicleStatus,
  selected = false
): DriverIcon {
  // 34px selected, 28px otherwise: big enough to read the shape, small enough
  // that a dozen of them do not blanket the streets.
  const size = selected ? 34 : 28;
  const ring = STATUS_RING[status];
  const dim = status === 'offline' ? 0.55 : 1;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
    <defs>
      <filter id="d" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g opacity="${dim}" filter="url(#d)">
      <circle cx="20" cy="20" r="17" fill="${accent}" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="20" cy="20" r="18.6" fill="none" stroke="${ring}" stroke-width="2.6"/>
      <g transform="translate(8 8) scale(1)">
        <path d="${CAR_PATH}" fill="#ffffff"/>
      </g>
    </g>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size,
    anchor: size / 2,
    labelY: size / 2 + 11,
  };
}
