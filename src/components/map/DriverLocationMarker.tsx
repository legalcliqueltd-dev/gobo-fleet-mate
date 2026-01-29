import { OverlayView } from '@react-google-maps/api';
import { cn } from '@/lib/utils';

interface DriverLocationMarkerProps {
  position: { lat: number; lng: number };
  isTracking: boolean;
  heading?: number | null;
}

export default function DriverLocationMarker({
  position,
  isTracking,
  heading,
}: DriverLocationMarkerProps) {
  const hasHeading = heading !== null && heading !== undefined && !isNaN(heading);

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={() => ({ x: -24, y: -24 })}
    >
      <div className="relative w-12 h-12">
        {/* Pulse rings - only when tracking */}
        {isTracking && (
          <>
            <div className="absolute inset-0 rounded-full bg-success/30 driver-marker-pulse" />
            <div 
              className="absolute inset-0 rounded-full bg-success/20 driver-marker-pulse" 
              style={{ animationDelay: '0.6s' }}
            />
          </>
        )}

        {/* Main marker SVG */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          className="relative z-10"
        >
          <defs>
            {/* Gradient for tracking state */}
            <radialGradient id="markerGradientActive" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="hsl(142, 76%, 50%)" />
              <stop offset="100%" stopColor="hsl(142, 76%, 36%)" />
            </radialGradient>
            
            {/* Gradient for off-duty state */}
            <radialGradient id="markerGradientInactive" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="hsl(240, 5%, 55%)" />
              <stop offset="100%" stopColor="hsl(240, 5%, 40%)" />
            </radialGradient>

            {/* Glow filter */}
            <filter id="markerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer glow ring */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={isTracking ? 'hsl(142, 76%, 36%)' : 'hsl(240, 5%, 45%)'}
            strokeWidth="2"
            opacity="0.4"
          />

          {/* Main marker circle */}
          <circle
            cx="24"
            cy="24"
            r="14"
            fill={isTracking ? 'url(#markerGradientActive)' : 'url(#markerGradientInactive)'}
            stroke="white"
            strokeWidth="3"
            filter={isTracking ? 'url(#markerGlow)' : undefined}
          />

          {/* Inner highlight */}
          <circle
            cx="24"
            cy="20"
            r="5"
            fill="white"
            opacity="0.3"
          />
        </svg>

        {/* Direction arrow - only when tracking and has heading */}
        {isTracking && hasHeading && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-20 transition-transform duration-300"
            style={{ transform: `translateX(-50%) rotate(${heading}deg)` }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20">
              <path
                d="M8 0L14 12H2L8 0Z"
                fill="hsl(142, 76%, 36%)"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          </div>
        )}

        {/* Center dot */}
        <div 
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-20",
            isTracking ? "bg-white" : "bg-white/70"
          )}
        />
      </div>
    </OverlayView>
  );
}
