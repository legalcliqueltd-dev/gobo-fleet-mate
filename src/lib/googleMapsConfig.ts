// Google Maps API key — env var wins so deployments can rotate the key
// without a code change; the fallback keeps existing builds working.
// NOTE: restrict this key by HTTP referrer in Google Cloud Console.
export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAA9FQoMjAHnoFFRKlQ7TTSraI5Y6t-_P8';

// Shared libraries array — MUST be a module-level constant (not recreated per render)
// and MUST be identical across every useJsApiLoader call that shares the loader id
// 'google-map-script'. Otherwise Google Maps throws:
//   "Loader must not be called again with different options"
export const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

/**
 * Vector Map IDs, for the tilted "3D-like" driver map.
 *
 * Google only honours `tilt` and `heading` on a VECTOR map, and a map is
 * only vector if it is created with a Map ID whose rendering type is Vector
 * in Cloud Console, with Tilt and Rotation ticked. Without one, passing tilt
 * silently does nothing — so the driver map asks for tilt only when a Map ID
 * is configured, and stays flat otherwise rather than pretending.
 *
 * TWO IDs, not one. A Map ID carries its own cloud style, and one Map ID can
 * carry only one style — so light and dark each need their own. Set only the
 * light one and both themes use it; set neither and the map stays raster and
 * keeps the hand-written styles in `mapStyles.ts`.
 *
 * See docs/VECTOR_MAP_SETUP.md for the Cloud Console walkthrough.
 */
export const GOOGLE_MAPS_MAP_ID_LIGHT: string | undefined =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_LIGHT ||
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
  undefined;

export const GOOGLE_MAPS_MAP_ID_DARK: string | undefined =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_DARK ||
  GOOGLE_MAPS_MAP_ID_LIGHT;

/** The Map ID for this theme, or undefined when no vector map is configured. */
export function vectorMapId(isDark: boolean): string | undefined {
  return isDark ? GOOGLE_MAPS_MAP_ID_DARK : GOOGLE_MAPS_MAP_ID_LIGHT;
}

export const HAS_VECTOR_MAP = Boolean(GOOGLE_MAPS_MAP_ID_LIGHT);
