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
 * Vector Map ID, for the tilted "3D-like" driver map.
 *
 * Google only honours `tilt` and `heading` on a VECTOR map, and a map is only
 * vector if it is created with a Map ID whose renderer is set to vector in
 * Cloud Console. Without one, passing tilt silently does nothing — so the
 * driver map asks for tilt only when this is set, and stays flat otherwise
 * rather than pretending.
 *
 * To turn it on: Cloud Console → Google Maps Platform → Map Management →
 * Create Map ID (JavaScript, Vector, tilt + rotation enabled), then set
 * VITE_GOOGLE_MAPS_MAP_ID in the build environment.
 */
export const GOOGLE_MAPS_MAP_ID: string | undefined =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined;

export const HAS_VECTOR_MAP = Boolean(GOOGLE_MAPS_MAP_ID);
