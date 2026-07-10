import { useMemo } from 'react';
import L from 'leaflet';
import { TileLayer, Marker, Circle, AttributionControl, useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * Open-source map building blocks for the driver app (Leaflet + OSM).
 * No API key required. Tile sources:
 *  - Light roads: CARTO Voyager (OSM data)
 *  - Dark roads:  CARTO Dark Matter (OSM data)
 *  - Satellite:   Esri World Imagery
 */

export const DEFAULT_CENTER: [number, number] = [6.5244, 3.3792]; // Lagos

/**
 * Required OSM/CARTO attribution, restyled as a tiny translucent whisper
 * (see .leaflet-control-attribution in index.css) instead of the default
 * white tag that crowded the bottom controls. prefix={false} drops the
 * "Leaflet" flag link. Use with `attributionControl={false}` on MapContainer.
 */
export function MapAttribution() {
  return <AttributionControl position="bottomright" prefix={false} />;
}

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics';

export function AppTileLayer({ isDark, mapType }: { isDark: boolean; mapType: 'roadmap' | 'satellite' }) {
  if (mapType === 'satellite') {
    return (
      <TileLayer
        key="esri-satellite"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution={ESRI_ATTRIBUTION}
        maxZoom={19}
      />
    );
  }
  return isDark ? (
    <TileLayer
      // Voyager carries far more roads/detail than CARTO Dark Matter; inverting
      // it (CSS in index.css) yields a bold, readable dark map — "alive" at night.
      key="carto-voyager-inverted"
      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      attribution={OSM_ATTRIBUTION}
      subdomains="abcd"
      maxZoom={20}
      className="tiles-dark-invert"
    />
  ) : (
    <TileLayer
      key="carto-voyager"
      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      attribution={OSM_ATTRIBUTION}
      subdomains="abcd"
      maxZoom={20}
    />
  );
}

/** Driver position: pulsing dot with a heading arrow. */
export function DriverMarker({
  position,
  isTracking,
  heading,
}: {
  position: { lat: number; lng: number };
  isTracking: boolean;
  heading?: number | null;
}) {
  const icon = useMemo(() => {
    const hasHeading = heading !== null && heading !== undefined && !isNaN(heading);
    const rotation = hasHeading ? Math.round(heading!) : 0;
    const color = isTracking ? 'hsl(152 65% 38%)' : 'hsl(220 12% 55%)';
    return L.divIcon({
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `
        <div style="position:relative;width:44px;height:44px;">
          ${isTracking ? `<div class="driver-marker-pulse" style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.35;"></div>` : ''}
          <div style="position:absolute;inset:8px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transform:rotate(${rotation}deg);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2 L19 21 L12 17 L5 21 Z"/></svg>
          </div>
        </div>`,
    });
  }, [isTracking, heading]);

  return <Marker position={[position.lat, position.lng]} icon={icon} interactive={false} />;
}

/** GPS accuracy ring around the driver — makes the fix quality visible. */
export function AccuracyCircle({
  position,
  accuracy,
  isTracking,
}: {
  position: { lat: number; lng: number };
  accuracy: number | null;
  isTracking: boolean;
}) {
  if (!accuracy || accuracy <= 0 || accuracy > 500) return null;
  const color = isTracking ? 'hsl(152 65% 45%)' : 'hsl(220 12% 55%)';
  return (
    <Circle
      center={[position.lat, position.lng]}
      radius={accuracy}
      pathOptions={{ color, weight: 1, opacity: 0.5, fillColor: color, fillOpacity: 0.08 }}
      interactive={false}
    />
  );
}

/** Task drop-off pin. */
export function TaskMarker({
  position,
  onClick,
}: {
  position: { lat: number; lng: number };
  onClick?: () => void;
}) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: `
          <div style="width:36px;height:36px;border-radius:9999px;background:hsl(4 72% 46%);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>`,
      }),
    []
  );

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      eventHandlers={onClick ? { click: onClick } : undefined}
    />
  );
}

/** Pans with the driver while follow mode is on; reports manual drags. */
export function FollowController({
  center,
  follow,
  onUserDrag,
}: {
  center: { lat: number; lng: number } | null;
  follow: boolean;
  onUserDrag?: () => void;
}) {
  const map = useMap();

  useMapEvents({
    dragstart: () => onUserDrag?.(),
  });

  useEffect(() => {
    if (follow && center) {
      map.panTo([center.lat, center.lng], { animate: true });
    }
  }, [map, center, follow]);

  return null;
}
