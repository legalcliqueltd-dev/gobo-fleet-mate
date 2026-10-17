/**
 * Export the hand-written Google Maps style arrays to JSON files that
 * Cloud Console's map-style editor can import.
 *
 * A map ID makes the map vector (which is what makes tilt work), and a
 * vector map takes its styling from Cloud Console — the `styles` option is
 * ignored. So the styles that live in src/lib/mapStyles.ts have to be
 * recreated up there, and the console accepts exactly this JSON.
 *
 *   node scripts/export-map-styles.mjs
 */
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/map-styles';
mkdirSync(OUT, { recursive: true });

const res = await build({
  entryPoints: ['src/lib/mapStyles.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'node',
});

const mod = await import(
  'data:text/javascript;base64,' +
    Buffer.from(res.outputFiles[0].text).toString('base64')
);

const exports = {
  'nav-light.json': mod.NAV_LIGHT_STYLE,
  'nav-dark.json': mod.NAV_DARK_STYLE,
  'fleet-light.json': mod.LIGHT_MAP_STYLE,
  'fleet-dark.json': mod.DARK_MAP_STYLE,
};

for (const [name, style] of Object.entries(exports)) {
  if (!style) continue;
  writeFileSync(`${OUT}/${name}`, JSON.stringify(style, null, 2) + '\n');
  console.log(`wrote ${OUT}/${name} (${style.length} rules)`);
}
