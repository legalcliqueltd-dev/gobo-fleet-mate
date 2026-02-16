import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import { useCallback } from 'react';

type AdvancedMarkerProps = {
  position: google.maps.LatLngLiteral;
  onClick?: () => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  zIndex?: number;
  title?: string;
  /** SVG data URI or icon config — rendered as an <img> inside the overlay */
  iconUrl?: string;
  /** Pixel size of the icon (used for width, height, and centering offset) */
  iconSize?: number;
  /** Opacity 0-1 */
  opacity?: number;
  /** Children override iconUrl — render arbitrary JSX as the marker */
  children?: React.ReactNode;
};

/**
 * Drop-in replacement for the deprecated `<Marker>` from @react-google-maps/api.
 * Uses `<OverlayViewF>` to render custom HTML/SVG, avoiding the
 * `google.maps.Marker` deprecation warning.
 */
export default function AdvancedMarker({
  position,
  onClick,
  onMouseOver,
  onMouseOut,
  zIndex,
  title,
  iconUrl,
  iconSize = 32,
  opacity = 1,
  children,
}: AdvancedMarkerProps) {
  const getPixelPositionOffset = useCallback(
    () => ({ x: -(iconSize / 2), y: -(iconSize / 2) }),
    [iconSize],
  );

  return (
    <OverlayViewF
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={getPixelPositionOffset}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        title={title}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          zIndex: zIndex ?? 'auto',
          opacity,
          position: 'relative',
          width: iconSize,
          height: iconSize,
        }}
      >
        {children ?? (
          iconUrl ? (
            <img
              src={iconUrl}
              width={iconSize}
              height={iconSize}
              alt={title || 'marker'}
              style={{ display: 'block', pointerEvents: 'none' }}
              draggable={false}
            />
          ) : null
        )}
      </div>
    </OverlayViewF>
  );
}
