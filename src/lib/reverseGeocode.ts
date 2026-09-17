/**
 * Coordinates → a place a human recognises.
 *
 * A manager looking at the map does not think in latitude. They think "is he
 * at the depot or still on Awolowo Road?", and a marker sitting on a grey
 * rectangle answers neither. Find My never shows you numbers; it shows you a
 * street and a district, which is the whole reason its card reads as calm
 * rather than technical.
 *
 * Google charges per geocode and a tracked vehicle publishes a new position
 * every thirty seconds, so the results are cached on a ~110 m grid: a driver
 * crawling through traffic resolves once for the street, not once a fix. In
 * flight requests are shared too, because a re-render while the first lookup
 * is still open would otherwise pay for the same answer twice.
 */

type Cached = string | null;

const cache = new Map<string, Cached>();
const inFlight = new Map<string, Promise<Cached>>();

/** ~110 m of latitude. Fine enough to name the street, coarse enough to cache. */
function key(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/** The parts worth saying, in the order a person would say them. */
function shorten(result: google.maps.GeocoderResult): string | null {
  const part = (type: string) =>
    result.address_components.find((c) => c.types.includes(type))?.short_name;

  const street = part('route');
  const area =
    part('neighborhood') ?? part('sublocality_level_1') ?? part('sublocality') ?? part('locality');

  if (street && area && street !== area) return `${street}, ${area}`;
  if (street) return street;
  if (area) return area;

  // Fall back to the first two chunks of the formatted address — better than
  // the full string, which runs to the country and overflows every card.
  const chunks = result.formatted_address.split(',').map((s) => s.trim()).filter(Boolean);
  return chunks.slice(0, 2).join(', ') || null;
}

/**
 * Resolves lazily and never throws: a missing place line is a cosmetic loss,
 * and the card must still render if geocoding is unavailable or over quota.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<Cached> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (typeof google === 'undefined' || !google.maps?.Geocoder) return null;

  const k = key(lat, lng);
  if (cache.has(k)) return cache.get(k) ?? null;

  const existing = inFlight.get(k);
  if (existing) return existing;

  const request = new Promise<Cached>((resolve) => {
    new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      const place =
        status === google.maps.GeocoderStatus.OK && results?.[0] ? shorten(results[0]) : null;
      cache.set(k, place);
      inFlight.delete(k);
      resolve(place);
    });
  });

  inFlight.set(k, request);
  return request;
}
