/**
 * Deterministic per-driver accent color for identification on the map and
 * in the Drivers panel. Deliberately avoids the status hues (green = active,
 * amber = idle, gray = offline) so the two color systems never collide:
 * accent says WHO, status says HOW.
 */
const ACCENT_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#e11d48', // rose
  '#a855f7', // purple
  '#0ea5e9', // sky
];

export function getDriverAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}
