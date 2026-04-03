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
  const rotation = hasHeading ? heading : 0;

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={() => ({ x: -28, y: -28 })}
    >
      <div className="relative w-14 h-14">
        {/* Pulse rings - only when tracking */}
        {isTracking && (
          <>
            <div className="absolute inset-0 rounded-full bg-success/25 driver-marker-pulse" />
            <div
              className="absolute inset-0 rounded-full bg-success/15 driver-marker-pulse"
              style={{ animationDelay: '0.6s' }}
            />
          </>
        )}

        {/* Directional car marker */}
        <div
          className="relative z-10 w-14 h-14 flex items-center justify-center transition-transform duration-500 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Shadow */}
            <ellipse cx="28" cy="40" rx="10" ry="4" fill="black" opacity="0.15" />

            {/* Direction cone (visible when tracking with heading) */}
            {isTracking && hasHeading && (
              <path
                d="M28 6 L38 22 L28 18 L18 22 Z"
                fill="hsl(142, 76%, 36%)"
                opacity="0.5"
              />
            )}

            {/* Car body - modern top-down view */}
            <g>
              {/* Main body */}
              <rect
                x="18"
                y="18"
                width="20"
                height="26"
                rx="6"
                fill={isTracking ? 'hsl(142, 76%, 36%)' : 'hsl(240, 5%, 50%)'}
                stroke="white"
                strokeWidth="2.5"
              />

              {/* Windshield */}
              <rect
                x="21"
                y="20"
                width="14"
                height="7"
                rx="3"
                fill={isTracking ? 'hsl(142, 76%, 50%)' : 'hsl(240, 5%, 60%)'}
                opacity="0.8"
              />

              {/* Rear window */}
              <rect
                x="22"
                y="36"
                width="12"
                height="5"
                rx="2"
                fill={isTracking ? 'hsl(142, 76%, 50%)' : 'hsl(240, 5%, 60%)'}
                opacity="0.6"
              />

              {/* Left wheels */}
              <rect x="14" y="22" width="5" height="8" rx="2" fill={isTracking ? 'hsl(142, 76%, 25%)' : 'hsl(240, 5%, 35%)'} stroke="white" strokeWidth="1" />
              <rect x="14" y="34" width="5" height="8" rx="2" fill={isTracking ? 'hsl(142, 76%, 25%)' : 'hsl(240, 5%, 35%)'} stroke="white" strokeWidth="1" />

              {/* Right wheels */}
              <rect x="37" y="22" width="5" height="8" rx="2" fill={isTracking ? 'hsl(142, 76%, 25%)' : 'hsl(240, 5%, 35%)'} stroke="white" strokeWidth="1" />
              <rect x="37" y="34" width="5" height="8" rx="2" fill={isTracking ? 'hsl(142, 76%, 25%)' : 'hsl(240, 5%, 35%)'} stroke="white" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* Center accuracy dot */}
        <div
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-20',
            isTracking ? 'bg-white' : 'bg-white/70'
          )}
        />
      </div>
    </OverlayView>
  );
}
