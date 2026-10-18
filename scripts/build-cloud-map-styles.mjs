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
 * `variant` IS NOT COSMETIC. It sets the fallback for every feature the style
 * does not name, so a dark-coloured style declared `light` renders its
 * unstyled features — buildings especially — in Google's light greys. The
 * light style is light-type and goes in a Map ID's Light slot; the dark style
 * is dark-type, goes in the Dark slot, and the app asks for that slot by
 * passing colorScheme DARK. See docs/VECTOR_MAP_SETUP.md.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/map-styles';
mkdirSync(OUT, { recursive: true });

/** Build one cloud style from a flat palette. Same shape for both themes. */
function cloudStyle({ variant, base, land, water, building, buildingEdge, local, arterial, highway, highwayEdge, labelFill, labelHalo }) {
  return {
    variant,
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

      // EVERY land child is named, not just `natural.land`. Leaving the
      // children unset let Google fill parks, campuses and forest with its
      // own colours, and on a dark map that produced a white slab across the
      // bottom of the screen and bright green hairlines through it — the
      // ground fighting the route instead of sitting behind it.
      { id: 'natural.land', geometry: { fillColor: land } },
      { id: 'natural.land.landCover', geometry: { fillColor: land } },
      { id: 'natural.land.landCover.forest', geometry: { fillColor: land } },
      { id: 'natural.land.landCover.ice', geometry: { fillColor: land } },
      { id: 'natural.land.landCover.sand', geometry: { fillColor: land } },
      { id: 'natural.land.landCover.shrub', geometry: { fillColor: land } },
      { id: 'pointOfInterest.recreation.park', geometry: { fillColor: land }, label: { visible: false } },
      { id: 'pointOfInterest.business', geometry: { fillColor: land }, label: { visible: false } },

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

// TrackMate's own palette, not the old asphalt greys. The first dark map
// built from the legacy hexes came out as stark black blocks on near-white
// ground — maximum contrast, which is the opposite of what you want behind a
// moving vehicle at night. These sit in a narrow band so the ROUTE and the
// driver's marker are the only high-contrast things on the screen.
const files = {
  'nav-light.cloud.json': cloudStyle({
    variant: 'light',
    base: '#f4f6fa',
    land: '#eef1f7',
    water: '#dcebff', // the brand's pale blue
    building: '#e4e8f2',
    buildingEdge: '#dadfeb',
    local: '#ffffff',
    arterial: '#ffffff',
    highway: '#ffffff',
    highwayEdge: '#dfe4ee',
    labelFill: '#6b7490',
    labelHalo: '#ffffff',
  }),
  'nav-dark.cloud.json': cloudStyle({
    // DARK, not light. Declaring this light so it would fit a Map ID's Light
    // slot was a mistake with a visible cost: `variant` also decides the
    // fallback for every feature the style does NOT name, so buildings came
    // back Google's light grey and the dark map grew a field of white blocks
    // on navy ground. A dark-type style defaults dark, and goes in the Dark
    // slot with the map asking for colorScheme DARK.
    variant: 'dark',
    base: '#050a2a',     // navy, a shade off #000738 so the ground is not pure brand
    land: '#040820',
    water: '#02061a',
    building: '#0d1442',
    buildingEdge: '#141c55',
    local: '#1b2456',
    arterial: '#26316e',
    highway: '#33408a',
    highwayEdge: '#0a1138',
    labelFill: '#8b96c9',
    labelHalo: '#02061a',
  }),
};

for (const [name, style] of Object.entries(files)) {
  writeFileSync(`${OUT}/${name}`, JSON.stringify(style, null, 2) + '\n');
  console.log(`wrote ${OUT}/${name} (${style.styles.length} rules)`);
}
