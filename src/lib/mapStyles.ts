/**
 * Theme-matched Google Maps styles — "Asphalt & Signal".
 * Light: cool paper landscape, white roads, amber-lit highways.
 * Dark: asphalt ink surfaces so the map matches the app instead of
 * blinding the driver at night.
 */

export const LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5b6472' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c6dff0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffd98f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f0c46a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#f7f8fa' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#edf0f4' }] },
];

export const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#111927' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a93a3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0c121c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#12202a' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e2836' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#151d29' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3323' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2b2519' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b111a' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0f1622' }] },
];

export function getMapStyle(isDark: boolean): google.maps.MapTypeStyle[] {
  return isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
}

/** Route/trail polyline colors that read on both map themes. */
export function getRouteStrokeColor(isDark: boolean): string {
  return isDark ? '#6fb4ff' : '#1d63d8';
}
