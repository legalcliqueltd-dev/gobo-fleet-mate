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
 * Below ~12 a city fits the screen and pins would tile over the roads, so they
 * collapse to dots that still show WHERE stations are without hiding anything.
 */
export function tierForZoom(zoom: number): MarkerTier {
  if (zoom < 12) return 'dot';
  if (zoom < 15) return 'small';
  return 'full';
}

const SIZES: Record<MarkerTier, number> = { dot: 14, small: 26, full: 34 };

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * A station marker sized for the current zoom.
 *
 * `dimmed` fades a station whose work is already done, so attention falls on
 * what is still outstanding rather than on what is finished.
 */
export function stationMarkerIcon(
  kind: StationKind,
  color: string,
  tier: MarkerTier,
  dimmed = false
): { url: string; size: number } {
  const size = SIZES[tier];
  const opacity = dimmed ? 0.45 : 1;

  if (tier === 'dot') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2.5}" fill="${color}" fill-opacity="${opacity}" stroke="#ffffff" stroke-width="2"/>
    </svg>`;
    return { url: svgToDataUri(svg), size };
  }

  const glyphScale = (size * 0.5) / 24;
  const glyphOffset = (size - size * 0.5) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" fill-opacity="${opacity}"
            stroke="#ffffff" stroke-width="2.5" filter="url(#s)"/>
    <g transform="translate(${glyphOffset} ${glyphOffset}) scale(${glyphScale})" opacity="${opacity}">
      <path d="${GLYPHS[kind] ?? GLYPHS.checkpoint}" fill="#ffffff"/>
    </g>
  </svg>`;

  return { url: svgToDataUri(svg), size };
}

/** Palette offered when picking a station's colour. */
export const STATION_COLORS = [
  '#2563eb', // blue
  '#0b8f4f', // green
  '#c47d0a', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#475569', // slate
];
