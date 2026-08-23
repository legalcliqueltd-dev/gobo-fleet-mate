import { useCallback, useEffect, useState } from 'react';

const KEY = 'ftm_show_stations_on_map';
const EVENT = 'ftm-station-map-pref';

/**
 * Whether stations are drawn on the manager's live maps.
 *
 * On by default: a vehicle's position only means something against the places
 * it is supposed to visit. But a manager running twenty stations across one
 * city may want the map clear while watching traffic, so it is a preference
 * rather than a fixed rule — set from the Stations screen, honoured by every
 * manager map.
 *
 * A custom event keeps every mounted map in step, since `storage` only fires
 * in OTHER tabs and would leave this one stale.
 */
export function useStationMapPreference() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setEnabled(localStorage.getItem(KEY) !== 'false');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      /* ignore */
    }
    setEnabled(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { enabled, toggle };
}
