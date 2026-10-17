# Turning on the tilted ("3D") driver map

Written for: whoever has access to the TrackMate Google Cloud project.

The driver's navigation map is flat today. Tilting it is not a code change —
the code is already written and waiting. It needs two **Map IDs** created in
Google Cloud Console, because Google only tilts a map that is rendered as
**vector**, and a map is only vector if it is created with a vector Map ID.

Budget about 20 minutes. Nothing here changes what the app costs: a vector
map bills on the same Dynamic Maps SKU as the flat one.

---

## Why two Map IDs and not one

A Map ID carries its own **style**, defined in Cloud Console rather than in
our code. One Map ID can carry one style. TrackMate has a light map and a
dark map, so it needs one Map ID each.

This is also the part that costs us something. The moment a map is vector,
Google **ignores the `styles` we send from code** — the hand-written styles
in `src/lib/mapStyles.ts` stop applying. That is why step 2 below imports
them into Cloud Console. Skip it and the driver gets Google's default map
colours instead of ours.

---

## 1. Create the two Map IDs

1. Open <https://console.cloud.google.com/google/maps-apis/studio/maps> and
   check the project picker at the top is the **same project the Maps API key
   belongs to**. Google recommends this and some features require it.
2. Click **Create map ID**.
   - **Map name**: `TrackMate Nav Light`
   - **Map type**: **JavaScript**
   - **Rendering type**: **Vector**
   - Tick **Tilt** and tick **Rotation**.
     Leaving these unticked blocks tilt *even from code*, which is exactly the
     failure this whole document exists to avoid.
3. Save. Copy the Map ID — a short string like `a1b2c3d4e5f6g7h8`.
4. Repeat for `TrackMate Nav Dark`, same settings.

You now have two IDs. They are **not secrets** — they travel in plain sight in
every map request, which is why they live in `.env` rather than anywhere
guarded.

## 2. Give each Map ID our styling

Our existing styles have been exported for you as console-importable JSON:

| File | Import into |
| --- | --- |
| `docs/map-styles/nav-light.json` | the style for **TrackMate Nav Light** |
| `docs/map-styles/nav-dark.json` | the style for **TrackMate Nav Dark** |

1. Go to **Map styles** → **Create style**.
2. Choose **Import JSON**, paste the contents of `nav-light.json`, save it as
   `TrackMate Nav Light`.
3. On the saved style, **Associate** it with the `TrackMate Nav Light` map ID.
4. Repeat with `nav-dark.json` and the dark map ID.

> Re-exporting: if `src/lib/mapStyles.ts` ever changes, run
> `node scripts/export-map-styles.mjs` to regenerate these JSON files, then
> re-import. The same folder also holds `fleet-light.json` / `fleet-dark.json`
> for the manager's map, for whenever that goes vector too.

Google's styling format has moved on, and on import it now **silently drops
rules it does not recognise** rather than complaining. So after associating,
open the driver app and look at the map before calling it done.

## 3. Put the IDs in the build

In `.env`:

```
VITE_GOOGLE_MAPS_MAP_ID_LIGHT=your_light_map_id
VITE_GOOGLE_MAPS_MAP_ID_DARK=your_dark_map_id
```

These are read at **build time**, not at runtime, so they have to be present
wherever the app is built:

- **Local / Android release** — `.env` is enough; it is committed, since it
  holds only `VITE_`-prefixed public values.
- **Web host** — add both to the hosting project's environment variables and
  redeploy. A build that ran before you added them keeps the flat map.

Setting only `..._LIGHT` is valid: both themes then use that one ID. Setting
neither leaves everything exactly as it is today.

## 4. Build and check

```bash
npm run build                                   # web
VITE_BUILD_TARGET=driver-native npx vite build  # native LAST, or the web
                                                # bundle overwrites it
npm run cap:sync:android
```

Then on a device: open a job with a drop-off → **Navigate**. The map should
sit at a 50° tilt, buildings standing up, and two-finger drag should rotate
and change the pitch.

---

## If it is still flat

**Check the rendering type first.** A Map ID created as Raster will be
accepted by the code and silently refuse to tilt — identical symptom to
having no Map ID at all. Cloud Console shows the rendering type on the Map ID;
it cannot be changed after creation, so make a new one.

**Then check Tilt and Rotation are ticked** on the Map ID. Same symptom again.

**Then check the project.** A Map ID from project A used with an API key from
project B does not work.

**Then check the build actually saw the variable.** Vite inlines it at build
time; a stale bundle will not have it:

```bash
grep -c "VITE_GOOGLE_MAPS_MAP_ID" dist/assets/*.js   # expect 0 — it is inlined
grep -o "your_light_map_id" dist/assets/*.js | head  # expect a hit
```

**Map looks wrong rather than flat?** That is step 2 — the Map ID is working
and no style is associated with it, so you are seeing Google's defaults.

---

## What is wired on our side

- `src/lib/googleMapsConfig.ts` — reads the two IDs, `vectorMapId(isDark)`
  returns the right one, `HAS_VECTOR_MAP` says whether any is configured.
- `src/components/map/TaskNavigationMap.tsx` — sends `mapId`, `tilt: 50`,
  `heading`, and enables tilt/heading gestures when an ID exists; falls back
  to the code styles when it does not. The Map ID is the component `key`,
  because a Map ID is fixed for the life of a map instance and a theme change
  has to build a new one.
- Only the **navigation** map is wired. The driver's home strip and the
  manager's fleet map are deliberately still raster — a tilted map is useful
  when you are driving towards something and a nuisance when you are reading
  a city.
