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

A Map ID carries its **style**, defined in Cloud Console rather than in our
code. The moment a map is vector, Google **ignores the `styles` we send from
code** — the hand-written styles in `src/lib/mapStyles.ts` stop applying.
That is why step 2 imports them into Cloud Console. Skip it and the driver
gets Google's default map colours instead of ours.

A Map ID actually has **two** style slots, Light mode and Dark mode, chosen
by the map's `colorScheme`. We do not use that mechanism, for two reasons:

1. A style's light-or-dark *type* is fixed when it is created, and a style
   imported from JSON is registered as a **light** style. It will never
   appear in the Dark slot's picker — the picker says "You haven't created
   any styles yet", which means "no dark-TYPE styles", not what it sounds
   like.
2. Google's own documentation says custom Map ID styles are "only compatible
   with the light color scheme for roadmap map types".

So **both Map IDs use their Light mode slot**, and the app chooses between
the two IDs from its own theme. The slot name only decides which
`colorScheme` selects it; we never set `colorScheme`, so it is always LIGHT,
and the style sitting in that slot renders whatever colours it contains —
including our dark ones. Leave both Dark mode slots on Google default;
nothing ever asks for them.

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

1. Go to **Map styles** → **Create style** → the **JSON** tab.
2. Use **Upload** and pick the file, rather than pasting. The editor is not
   empty when it opens, so pasting without clearing it first stacks two JSON
   documents in one box and the console reports a syntax error in a file that
   is perfectly valid.
3. Save it as `TrackMate Nav Light`, and **publish** it. A saved-but-
   unpublished style does nothing.
4. Repeat with `nav-dark.json` as `TrackMate Nav Dark`.
5. Attach them: **Map Management** → the map ID → **Map styles** section →
   **Edit** on the **Light mode** slot → pick the matching style → **Save**.
   The light Map ID gets the light style; the dark Map ID gets the DARK style
   in its **Light mode** slot. See the section above for why.

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
and no style is attached to its Light mode slot, so you are seeing Google's
defaults. The Map ID page's own preview shows this before you ever build:
stock green landscape, POI pins and highway shields means nothing is
attached.

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
