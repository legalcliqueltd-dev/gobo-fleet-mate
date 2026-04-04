

## Fix: Remove Transistorsoft from Android builds

### Root cause
`@transistorsoft/capacitor-background-geolocation` and `@transistorsoft/capacitor-background-fetch` are listed in `package.json` as regular dependencies. When `npx cap sync android` runs, Capacitor auto-registers them in the Android Gradle files. These packages require a paid license and their Maven artifacts (`com.transistorsoft:tslocationmanager`) are not publicly available — causing the build to fail.

The post-sync cleanup script exists but: (1) it only works if you remember to run it, and (2) the checked-in Gradle files in the repo still contain Transistorsoft references.

### What we'll do

**Step 1: Clean the checked-in Android Gradle files**
- Remove all Transistorsoft lines from `android/capacitor.settings.gradle` (lines 11-14)
- Remove all Transistorsoft lines from `android/app/capacitor.build.gradle`
- Remove Transistorsoft entry from `android/app/src/main/assets/capacitor.plugins.json`

**Step 2: Prevent Capacitor from re-adding Transistorsoft on Android**
- Add `includePlugins` to the top-level `capacitor.config.ts` to whitelist only `@capacitor/camera` and `@capacitor/geolocation` — this tells `cap sync` to skip Transistorsoft entirely
- Keep the npm packages installed (they're still needed for iOS builds via `useIOSBackgroundTracking.ts`)

**Step 3: Update the driver config too**
- Add the same `includePlugins` to `capacitor.config.driver.ts`

This is a permanent fix — no more relying on cleanup scripts to undo what `cap sync` just did.

### Files to modify
- `capacitor.config.ts` — add `includePlugins` array
- `capacitor.config.driver.ts` — add `includePlugins` array
- `android/capacitor.settings.gradle` — remove Transistorsoft lines
- `android/app/capacitor.build.gradle` — remove Transistorsoft lines
- `android/app/src/main/assets/capacitor.plugins.json` — remove Transistorsoft entries

### After deploying
You'll need to:
1. `git pull`
2. Delete `android/` folder completely
3. `npx cap add android`
4. `npm run build`
5. `npx cap sync android`
6. Open in Android Studio and build

