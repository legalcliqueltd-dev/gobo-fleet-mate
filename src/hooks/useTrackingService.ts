import { useEffect, useState } from 'react';
import { trackingService, type TrackingState } from '@/services/trackingService';

/**
 * React hook that subscribes to the persistent tracking singleton.
 * NEVER stops tracking on unmount — the service lives outside React.
 *
 * To start tracking, call trackingService.start(driverId, adminCode).
 * To stop tracking (only on user action), call trackingService.stop().
 */
export function useTrackingService(): TrackingState {
  const [state, setState] = useState<TrackingState>(trackingService.getState());

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<TrackingState>;
      setState(ce.detail);
    };
    trackingService.addEventListener('state-changed', handler as EventListener);
    // Sync once on mount in case state changed before listener attached
    setState(trackingService.getState());
    return () => {
      trackingService.removeEventListener('state-changed', handler as EventListener);
    };
  }, []);

  return state;
}
