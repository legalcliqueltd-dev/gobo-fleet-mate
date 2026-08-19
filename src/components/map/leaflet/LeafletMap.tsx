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

/**
 * A vehicle on the manager's fleet map: one small car glyph with the driver's
 * name attached beneath it. Mirrors the web dashboard's fused marker so both
 * surfaces identify vehicles the same way — the status hue says HOW (moving /
 * idle / offline) and the accent stripe says WHO.
 */
export function FleetVehicleMarker({
  position,
  name,
  accent,
  status,
  selected,
  onClick,
}: {
  position: { lat: number; lng: number };
  name: string;
  accent: string;
  status: 'moving' | 'idle' | 'offline';
  selected?: boolean;
  onClick?: () => void;
}) {
  const icon = useMemo(() => {
    const size = selected ? 34 : 28;
    const statusColor =
      status === 'moving'
        ? 'hsl(152 65% 38%)'
        : status === 'idle'
          ? 'hsl(33 94% 44%)'
          : 'hsl(220 12% 55%)';
    const label = name.length > 16 ? `${name.slice(0, 15)}…` : name;
    const escaped = label.replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string
    );

    return L.divIcon({
      className: '',
      iconSize: [140, size + 26],
      iconAnchor: [70, size / 2],
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;width:140px;">
          <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${statusColor};border:${selected ? 3 : 2}px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">
            <svg width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
          </div>
          <div style="margin-top:3px;max-width:132px;padding:2px 6px;border-left:3px solid ${accent};border-radius:3px;background:rgba(255,255,255,.94);box-shadow:0 1px 4px rgba(0,0,0,.28);font-family:Barlow,system-ui,sans-serif;font-size:11px;font-weight:600;line-height:1.25;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escaped}</div>
        </div>`,
    });
  }, [name, accent, status, selected]);

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
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
