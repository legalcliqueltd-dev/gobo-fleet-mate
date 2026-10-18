/**
 * Emit TrackMate's map styles in Google's CLOUD-BASED styling schema.
 *
 *   node scripts/build-cloud-map-styles.mjs
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT src/lib/mapStyles.ts
 *
 * There are two incompatible Google map style formats:
 *
 *   LEGACY  an array of { featureType, elementType, stylers }. This is what
 *           `src/lib/mapStyles.ts` holds and what the `styles` map option
 *           takes. It only works on RASTER maps.
 *   CLOUD   an object { variant, backgroundColor, styles: [{ id, geometry,
 *           label }] }. This is what the Cloud Console style editor reads,
 *           and the only styling a VECTOR map (a map with a Map ID) obeys.
 *
 * They are not convertible by the client. Uploading a legacy array into the
 * console's JSON tab does not error usefully — it silently produces an empty
 * style, `{ "variant": "light" }`, and your map renders Google's defaults.
 * So the cloud styles are authored here, from the same hex values, and
 * uploaded as files.
 *
 * BOTH FILES DECLARE `variant: "light"` ON PURPOSE. A style's light/dark type
 * is fixed at creation and the console will only offer a light-type style for
 * a Map ID's Light slot — and the Light slot is the one that renders, because
 * we never set `colorScheme`. The dark style is simply a light-TYPE style
 * made of dark colours. See docs/VECTOR_MAP_SETUP.md.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/map-styles';
mkdirSync(OUT, { recursive: true });

/** Build one cloud style from a flat palette. Same shape for both themes. */
function cloudStyle({ base, land, water, building, buildingEdge, local, arterial, highway, highwayEdge, labelFill, labelHalo }) {
  return {
    variant: 'light',
    backgroundColor: base,
    metadata: {
      source: 'TrackMate — scripts/build-cloud-map-styles.mjs',
      note: 'Driver navigation map. Edit the script, not this file.',
    },
    styles: [
      { id: 'natural.base', geometry: { fillColor: base } },

      // Nothing that is not road, water or the driver's own route earns ink.
      // A driver glancing down at 60km/h is looking for one line.
      { id: 'pointOfInterest', geometry: { visible: false }, label: { visible: false } },
      { id: 'infrastructure.transitStation', geometry: { visible: false }, label: { visible: false } },
      { id: 'infrastructure.railwayTrack', geometry: { visible: false } },

      { id: 'natural.land', geometry: { fillColor: land } },
      { id: 'natural.water', geometry: { fillColor: water }, label: { visible: false } },

      // Buildings stay: extruded footprints are what makes the tilted view
      // read as three-dimensional at all. Toned so they sit under the roads.
      { id: 'infrastructure.building', geometry: { fillColor: building, strokeColor: buildingEdge } },

      // Road hierarchy by lightness alone — highway brightest, local dimmest.
      { id: 'infrastructure.roadNetwork.road.local', geometry: { fillColor: local } },
      { id: 'infrastructure.roadNetwork.road.arterial', geometry: { fillColor: arterial } },
      { id: 'infrastructure.roadNetwork.road.highway', geometry: { fillColor: highway, strokeColor: highwayEdge } },
      {
        id: 'infrastructure.roadNetwork.road',
        label: { textFillColor: labelFill, textStrokeColor: labelHalo, textStrokeWeight: 3 },
      },

      // Borders off, place names on — a driver needs to know the district,
      // not where the local government boundary runs.
      {
        id: 'political',
        geometry: { visible: false },
        label: { textFillColor: labelFill, textStrokeColor: labelHalo, textStrokeWeight: 3 },
      },
    ],
  };
}

// Hex values lifted from NAV_LIGHT_STYLE / NAV_DARK_STYLE in src/lib/mapStyles.ts.
const files = {
  'nav-light.cloud.json': cloudStyle({
    base: '#f2f3f5',
    land: '#eceef1',
    water: '#cdd8e3',
    building: '#e6e9ed',
    buildingEdge: '#dce0e6',
    local: '#ffffff',
    arterial: '#ffffff',
    highway: '#ffffff',
    highwayEdge: '#dfe3e8',
    labelFill: '#8b93a1',
    labelHalo: '#ffffff',
  }),
  'nav-dark.cloud.json': cloudStyle({
    base: '#12161d',
    land: '#0e1218',
    water: '#070a0e',
    building: '#1a202a',
    buildingEdge: '#232a36',
    local: '#242c38',
    arterial: '#2e3846',
    highway: '#3b4657',
    highwayEdge: '#161b23',
    labelFill: '#7d8695',
    labelHalo: '#0a0d12',
  }),
};

for (const [name, style] of Object.entries(files)) {
  writeFileSync(`${OUT}/${name}`, JSON.stringify(style, null, 2) + '\n');
  console.log(`wrote ${OUT}/${name} (${style.styles.length} rules)`);
}
