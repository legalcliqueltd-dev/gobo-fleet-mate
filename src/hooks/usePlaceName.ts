import { useEffect, useState } from 'react';
import { reverseGeocode } from '@/lib/reverseGeocode';

/**
 * The street a position is on, resolved in the background.
 *
 * Returns null until it knows, so callers render the rest of the card
 * immediately and let the place line appear when it arrives — a card that
 * waits on a network round trip before showing a driver's name has got its
 * priorities backwards.
 */
export function usePlaceName(lat: number | null | undefined, lng: number | null | undefined) {
  const [place, setPlace] = useState<string | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) {
      setPlace(null);
      return;
    }

    let live = true;
    void reverseGeocode(lat, lng).then((result) => {
      if (live) setPlace(result);
    });
    return () => {
      live = false;
    };
    // Rounded so a vehicle inching down a street does not re-resolve on every
    // fix; the cache would absorb it, but this avoids the churn entirely.
  }, [lat == null ? null : Number(lat.toFixed(3)), lng == null ? null : Number(lng.toFixed(3))]); // eslint-disable-line react-hooks/exhaustive-deps

  return place;
}
