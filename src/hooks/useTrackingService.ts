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

export interface TrackingWarning {
  code: 'NOT_AUTHORIZED' | 'NEEDS_ALWAYS_PERMISSION';
  message: string;
}

/**
 * Permission problems that silently stop tracking.
 *
 * Kept separate from TrackingState because these are not states the service
 * moves through — they are conditions the driver has to go and fix in the OS
 * settings, and until they do, the app looks like it is tracking while
 * recording nothing. That gap between "appears on duty" and "is actually
 * reporting" is the whole failure this surfaces.
 */
export function useTrackingWarning(): TrackingWarning | null {
  const [warning, setWarning] = useState<TrackingWarning | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TrackingWarning>).detail;
      if (detail?.code) setWarning(detail);
    };
    trackingService.addEventListener('error', handler as EventListener);
    return () => trackingService.removeEventListener('error', handler as EventListener);
  }, []);

  return warning;
}
