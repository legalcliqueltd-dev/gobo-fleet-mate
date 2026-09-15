/**
 * Pulled from the app's "Asphalt & Signal" system (src/index.css) so the promo
 * and the product look like the same thing. A promo in different colours from
 * the app it advertises quietly undermines both.
 */
export const COLORS = {
  ink: '#0d1320',
  inkSoft: '#162032',
  land: '#24304a',
  landEdge: '#3d5176',
  primary: '#3b82f6',
  primaryDeep: '#1d4ed8',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#f2f5f9',
  textDim: '#93a1b5',
} as const;

export const FONT_STACK =
  '"Barlow Semi Condensed", "Barlow", "Segoe UI", system-ui, sans-serif';

/** The stations the promo narrates. Real Lagos coordinates. */
export type Station = {
  name: string;
  kind: 'depot' | 'dump' | 'drop';
  lng: number;
  lat: number;
};

export const STATIONS: Station[] = [
  { name: 'Ikeja Depot', kind: 'depot', lng: 3.3426, lat: 6.6018 },
  { name: 'Ojota Dump Site', kind: 'dump', lng: 3.3792, lat: 6.5833 },
  { name: 'Lekki Drop-off', kind: 'drop', lng: 3.4706, lat: 6.4474 },
];

/** Lagos, the city the route plays out in. */
export const LAGOS = { lng: 3.3792, lat: 6.5244 };

/**
 * The route the vehicle drives, as real coordinates rather than a straight
 * line between pins — a dead-straight hop between two points reads as a
 * diagram, not a journey.
 */
export const ROUTE: [number, number][] = [
  [3.3426, 6.6018],
  [3.3512, 6.5981],
  [3.3634, 6.5902],
  [3.3729, 6.5861],
  [3.3792, 6.5833],
  [3.3901, 6.5702],
  [3.4025, 6.5488],
  [3.4188, 6.5201],
  [3.4342, 6.4903],
  [3.4521, 6.4688],
  [3.4706, 6.4474],
];
