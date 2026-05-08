import { useTrackingService } from './useTrackingService';

const DRIVING_SPEED_KMH = 5;

/**
 * True when the singleton tracking service reports speed above ~walking pace.
 * Used to surface a "please pull over before interacting" hint in the driver
 * app and to gate destructive / multi-step actions while moving (App Store
 * guideline 1.4.5 — don't encourage device use that risks physical harm).
 */
export function useDrivingMode(): { isDriving: boolean; speedKmh: number } {
  const tracking = useTrackingService();
  const speed = tracking.lastLocation?.speed ?? 0;
  const isDriving = speed > DRIVING_SPEED_KMH;
  return { isDriving, speedKmh: speed };
}
