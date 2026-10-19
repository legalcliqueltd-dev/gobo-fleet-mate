import type { StationKind } from '@/integrations/supabase/stations';

/**
 * Station markers that stay readable without burying the map.
 *
 * Three problems this solves, all of which the previous plain-circle markers
 * had:
 *
 *  1. Every station looked identical. A dump site and a school gate were the
 *     same coloured dot, so a manager could not tell a round apart at a
 *     glance. Each type now carries its own glyph.
 *  2. One fixed size is always wrong. Big enough to read when you are zoomed
 *     into a street is big enough to blanket the roads at city zoom. Size is
 *     therefore derived from zoom, collapsing to a plain dot when zoomed out.
 *  3. Flat colours vanish over satellite imagery. Every marker carries a white
 *     ring and a drop shadow, which is what keeps it legible on both a pale
 *     road map and a dark aerial photo.
 *
 * Rendered as inline SVG data URIs, so there are no image assets to ship and
 * the colour can be per-station.
 */

/** Simple, chunky glyph paths — legible at 14px, drawn on a 24x24 grid. */
const GLYPHS: Record<StationKind, string> = {
  // Waste bin
  dump_site:
    'M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z',
  // Box
  pickup: 'M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.5 8 12 11.7 5.5 8 12 4.3z',
  // Flag
  dropoff: 'M6 2v20h2v-8h9l-2-4 2-4H8V2H6z',
  // Building with roof
  school: 'M12 2 2 8h3v12h5v-6h4v6h5V8h3L12 2z',
  // Warehouse
  depot: 'M3 21V9l9-5 9 5v12h-6v-7H9v7H3z',
  // Map pin
  checkpoint: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  // Star
  custom: 'M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.7 21.2 7 14.2 2 9.4l7-.9L12 2z',
};

export type MarkerTier = 'dot' | 'small' | 'full';

/**
 * How much marker a given zoom can carry.
 * Below ~12 a city fits the screen and full pins would tile over the roads, so
 * they collapse to dots that still show WHERE stations are without hiding
 * anything.
 */
export function tierForZoom(zoom: number): MarkerTier {
  if (zoom < 12) return 'dot';
  if (zoom < 15) return 'small';
  return 'full';
}

/** Badge sizes per tier (the square; the pointer adds a little below). */
const BADGE: Record<MarkerTier, number> = { dot: 12, small: 24, full: 32 };

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Navy glyph on light fills (neon, amber), white on dark ones (navy). */
function glyphColorFor(fill: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(fill);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000738' : '#ffffff';
}

export type StationIcon = {
  url: string;
  width: number;
  height: number;
  /** Where the marker touches the map — the pointer's tip, not its middle. */
  anchorX: number;
  anchorY: number;
  /** Where a text label should sit, just under the tip. */
  labelY: number;
};

/**
 * A station is a rounded-square BADGE with a short pointer — not a teardrop.
 *
 * The teardrop was the same shape as the navigation destination pin, and
 * dots are drivers, so a station never read as "a station". Now each thing
 * on a map has one shape: dots are people, the teardrop is where you are
 * going, badges are places on the round — the grammar Google uses for its
 * own place icons. The glyph says what kind of place; the fill says where it
 * stands today (pass a STATE_COLOR), with the glyph flipping navy or white
 * to stay readable on it.
 *
 * `dimmed` quietens a station whose work is done, so attention falls on what
 * is still outstanding.
 */
export function stationMarkerIcon(
  kind: StationKind,
  rawColor: string,
  tier: MarkerTier,
  dimmed = false
): StationIcon {
  const color = brandSafeStationColor(rawColor);
  const glyphColor = glyphColorFor(color);
  const opacity = dimmed ? 0.8 : 1;

  if (tier === 'dot') {
    const size = BADGE.dot + 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="2" y="2" width="${BADGE.dot}" height="${BADGE.dot}" rx="3.5" fill="${color}" fill-opacity="${opacity}" stroke="#ffffff" stroke-width="2"/>
    </svg>`;
    return {
      url: svgToDataUri(svg),
      width: size,
      height: size,
      anchorX: size / 2,
      anchorY: size / 2,
      labelY: size + 6,
    };
  }

  const side = BADGE[tier];
  const pad = 3; // room for the white ring and the shadow
  const pointer = Math.round(side * 0.22);
  const width = side + pad * 2;
  const height = side + pad * 2 + pointer;
  const cx = width / 2;
  const glyph = Math.round(side * 0.56);
  const scale = glyph / 24;
  const radius = Math.round(side * 0.3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <g opacity="${opacity}" filter="url(#s)">
      <path d="M${cx - pointer * 0.8} ${pad + side - 1} L${cx} ${pad + side + pointer} L${cx + pointer * 0.8} ${pad + side - 1} Z" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
      <rect x="${pad}" y="${pad}" width="${side}" height="${side}" rx="${radius}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <rect x="${cx - pointer * 0.7}" y="${pad + side - 3}" width="${pointer * 1.4}" height="3" fill="${color}"/>
      <g transform="translate(${cx - glyph / 2} ${pad + (side - glyph) / 2}) scale(${scale})">
        <path d="${GLYPHS[kind] ?? GLYPHS.checkpoint}" fill="${glyphColor}"/>
      </g>
    </g>
  </svg>`;

  return {
    url: svgToDataUri(svg),
    width,
    height,
    anchorX: cx,
    anchorY: height,
    labelY: height + 8,
  };
}

/**
 * Palette offered when picking a station's colour.
 *
 * Four, all in the brand's own hue families, all dark enough for the white
 * glyph the pin draws on top. The old list had eight free hues including a
 * red, a violet and a pink — red is reserved for SOS and the rest were from
 * no palette at all, so a map of a dozen stations stopped looking like this
 * product.
 */
export const STATION_COLORS = [
  '#000738', // navy — the brand ink
  '#007018', // deep green, the neon's hue at marker darkness
  '#8f6900', // deep amber
  '#1b2998', // mid navy-blue
];

/**
 * Snap any stored colour onto the palette above.
 *
 * Stations created before the rebrand still hold `#dc2626` and friends in the
 * database. Rather than migrate rows, every pin is drawn through this, so a
 * legacy red station renders navy until someone edits it.
 */
export function brandSafeStationColor(hex: string | null | undefined): string {
  if (!hex) return STATION_COLORS[0];
  const want = hex.trim().toLowerCase();
  if ((STATION_COLORS as string[]).includes(want)) return want;
  // The visit-state colours (neon done, amber arrived) are brand colours too.
  if (want === '#00ff39' || want === '#ffbf0b') return want;

  const rgb = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const target = rgb(want);
  if (!target) return STATION_COLORS[0];

  let best = STATION_COLORS[0];
  let bestDist = Infinity;
  for (const candidate of STATION_COLORS) {
    const c = rgb(candidate)!;
    const d =
      (c[0] - target[0]) ** 2 + (c[1] - target[1]) ** 2 + (c[2] - target[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}
