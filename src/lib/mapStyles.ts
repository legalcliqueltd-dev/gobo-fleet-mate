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

/**
 * Navigation styles for the driver's own screen — the Uber / Bolt treatment.
 *
 * The dashboard map is glanced at while driving, so it is tuned differently
 * from the manager's overview map: the basemap recedes to near-monochrome and
 * everything that is not road geometry is stripped out (no POIs, no transit,
 * no business labels, no road icons). What survives is the road network and
 * the driver's own marker, which is the only thing that should draw the eye.
 * Road hierarchy is carried by lightness alone — highways brightest, local
 * streets dimmest — so the layout reads instantly at speed.
 */
export const NAV_LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f2f3f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b93a1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#eceef1' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8ebee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cdd8e3' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#dfe3e8' }] },
];

export const NAV_DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#12161d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7d8695' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0d12' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0e1218' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070a0e' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#242c38' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2e3846' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3b4657' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#161b23' }] },
];

export function getNavMapStyle(isDark: boolean): google.maps.MapTypeStyle[] {
  return isDark ? NAV_DARK_STYLE : NAV_LIGHT_STYLE;
}

/** Route/trail polyline colors that read on both map themes. */
export function getRouteStrokeColor(isDark: boolean): string {
  return isDark ? '#6fb4ff' : '#1d63d8';
}
