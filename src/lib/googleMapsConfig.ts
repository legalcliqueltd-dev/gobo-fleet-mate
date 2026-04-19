// Google Maps API key
export const GOOGLE_MAPS_API_KEY = 'AIzaSyAA9FQoMjAHnoFFRKlQ7TTSraI5Y6t-_P8';

// Shared libraries array — MUST be a module-level constant (not recreated per render)
// and MUST be identical across every useJsApiLoader call that shares the loader id
// 'google-map-script'. Otherwise Google Maps throws:
//   "Loader must not be called again with different options"
export const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];
