/**
 * Snap a driven path onto the road network, for drawing.
 *
 * Raw GPS cuts corners, wanders into buildings and zig-zags along a straight
 * street. Google's Roads API fits the fixes to the roads actually driven, and
 * with `interpolate` fills in the curve of the road between them, so a drive
 * is drawn along the streets it used. Only the DRAWING changes: every
 * recorded fix stays in history, untouched.
 *
 * Billing: one request covers up to 100 points (most drives fit in one), and
 * results are cached per drive, so a day is fetched once per screen visit.
 * Any failure returns the raw path for that piece — a drive is never lost,
 * only left unsnapped.
 */
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';

type Point = { lat: number; lng: number };

const ROADS_URL = 'https://roads.googleapis.com/v1/snapToRoads';
/** The Roads API's limit per request. */
const CHUNK = 100;
/**
 * Fixes closer together than this add nothing to the match (a slow crawl or
 * a queue at a junction); dropping them keeps more of a drive in one request.
 */
const THIN_M = 10;
/** Requests in flight at once. */
const PARALLEL = 3;

const cache = new Map<string, Promise<Point[]>>();

/**
 * Snapped drives are also kept on the device, so reopening a day does not
 * pay Google again for drives it has already matched. A finished drive never
 * changes, so its snapped line never goes stale. Capped, oldest out first.
 */
const STORE_KEY = 'ftm_snapped_drives';
const STORE_MAX = 300;

function readStore(): Record<string, [number, number][]> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(key: string, path: Point[]) {
  try {
    const store = readStore();
    store[key] = path.map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
    const keys = Object.keys(store);
    for (const old of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) delete store[old];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked — the in-memory cache still works */
  }
}

function metres(a: Point, b: Point): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Keep a point only once it is THIN_M from the last kept one; always the ends. */
function thin(path: Point[]): Point[] {
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    if (metres(out[out.length - 1], path[i]) >= THIN_M) out.push(path[i]);
  }
  out.push(path[path.length - 1]);
  return out;
}

const keyOf = (path: Point[]) =>
  `${path.length}:${path[0]?.lat.toFixed(5)},${path[0]?.lng.toFixed(5)}:${path[path.length - 1]?.lat.toFixed(5)},${path[path.length - 1]?.lng.toFixed(5)}`;

async function snapPiece(points: Point[]): Promise<Point[] | null> {
  const path = points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
  const url = `${ROADS_URL}?interpolate=true&path=${encodeURIComponent(path)}&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const snapped = (data?.snappedPoints ?? []) as { location: { latitude: number; longitude: number } }[];
  if (snapped.length < 2) return null;
  return snapped.map((s) => ({ lat: s.location.latitude, lng: s.location.longitude }));
}

/** The path along the roads, or the original path if it cannot be matched. */
export function snapToRoads(path: Point[]): Promise<Point[]> {
  if (path.length < 2) return Promise.resolve(path);
  const key = keyOf(path);
  const hit = cache.get(key);
  if (hit) return hit;
  const stored = readStore()[key];
  if (stored) {
    const path2 = stored.map(([lat, lng]) => ({ lat, lng }));
    const done = Promise.resolve(path2);
    cache.set(key, done);
    return done;
  }

  const job = (async () => {
    try {
      const points = thin(path);
      // Overlapping by one point so the snapped pieces join up.
      const pieces: Point[][] = [];
      for (let i = 0; i < points.length - 1; i += CHUNK - 1) {
        const piece = points.slice(i, i + CHUNK);
        if (piece.length >= 2) pieces.push(piece);
      }
      const results: (Point[] | null)[] = new Array(pieces.length).fill(null);
      let next = 0;
      const worker = async () => {
        while (next < pieces.length) {
          const index = next++;
          results[index] = await snapPiece(pieces[index]).catch(() => null);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, pieces.length) }, worker));
      // A piece Google cannot place keeps its raw points; the rest still snaps.
      if (results.every((r) => r == null)) return path;
      const out: Point[] = [];
      results.forEach((r, index) => {
        const piece = r ?? pieces[index];
        out.push(...(out.length ? piece.slice(1) : piece));
      });
      if (out.length < 2) return path;
      // Only a fully snapped drive is worth keeping; a partial one may
      // succeed in full next time.
      if (results.every((r) => r != null)) writeStore(key, out);
      return out;
    } catch {
      return path;
    }
  })();
  cache.set(key, job);
  return job;
}
