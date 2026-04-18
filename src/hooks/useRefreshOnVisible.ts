import { useEffect, useRef } from 'react';

/**
 * Calls `callback` whenever the tab/page becomes visible again
 * (e.g. user switches back from another tab, or returns from background).
 * Useful for refreshing stale data after the user is gone for a while.
 */
export function useRefreshOnVisible(callback: () => void) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        cbRef.current();
      }
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
  }, []);
}
