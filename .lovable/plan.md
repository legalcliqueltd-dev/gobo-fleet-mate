

## Plan: Update Capacitor Config — App Identity & URL

### Changes to `capacitor.config.ts`

| Field | Current | New |
|-------|---------|-----|
| `appId` | `app.lovable.d78756af7da0400ebb464b099b10699b` | `app.fleettrackmate.driver` |
| `appName` | `gobo-fleet-mate` | `FleetTrackMate-Driver` |
| `server.url` | `https://fleettrackmate.com/app?forceHideBadge=true` | `https://fleettrackmate.com/app?forceHideBadge=true` |

The `server.url` already points to `fleettrackmate.com`. If you want a different URL, let me know — otherwise only `appId` and `appName` need updating.

### After the change

You must re-create the Android platform since the package name changed:

```powershell
# From project root
Remove-Item -Recurse -Force android
npx cap add android
npm run build
npx cap sync android
powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1
```

Then in Android Studio: re-add your launcher icon via **Image Asset** wizard and rebuild.

### Launcher Icon

Yes — since the `android/` folder will be recreated, you must re-add the launcher icon in Android Studio:
1. Right-click `android/app/res` → **New → Image Asset**
2. Select your 512x512 PNG source
3. Configure layers → **Finish**

