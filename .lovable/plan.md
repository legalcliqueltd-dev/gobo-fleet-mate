

# Fix: Auto-trigger Android permission dialog on first launch

## Problem
On Android, Capacitor's `checkPermissions()` returns `"denied"` even when permission has never been asked. The current code treats this as a final state and shows the blocker UI immediately — the system permission dialog is never triggered automatically.

## Root cause (line 93-101 in LocationBlocker.tsx)
```
} else {
  // status is "denied" — shows blocked UI without attempting requestPermissions()
  setHasPermission(false);
  if (isAndroidNative) {
    hasAttemptedRequest.current = true;  // locks out future auto-checks
  }
}
```

On first launch, `checkPermission(false)` runs → gets `denied` → shows UI → marks `hasAttemptedRequest = true` → done. The user sees the blocker but the OS was never asked.

## Fix (single file: `src/components/driver/LocationBlocker.tsx`)

1. **In `checkPermission`, when status is `denied` on Android and this is the first check**: automatically call `Geolocation.requestPermissions()` followed by `Geolocation.getCurrentPosition()` to trigger the system dialog — exactly what `requestPermission()` already does.

2. **Only mark `hasAttemptedRequest = true` AFTER the automatic request attempt**, not before. This ensures the dialog gets one real chance to appear.

3. **If still denied after the auto-attempt**: then show the permanently-denied UI with the Settings redirect.

Specifically, replace the `else` block at lines 93-101 with:
```typescript
} else {
  // "denied" on Android could mean "never asked" — try requesting once automatically
  if (isAndroidNative && !hasAttemptedRequest.current) {
    console.log('[LocationBlocker] Android denied (possibly never asked) — auto-requesting...');
    hasAttemptedRequest.current = true;
    try {
      const reqResult = await Geolocation.requestPermissions();
      console.log('[LocationBlocker] Auto-request result:', JSON.stringify(reqResult));
      if (reqResult.location === 'granted' || reqResult.coarseLocation === 'granted') {
        setHasPermission(true);
        setPermanentlyDenied(false);
        onPermissionGranted();
      } else {
        // Try getCurrentPosition as secondary trigger
        try {
          await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          setHasPermission(true);
          onPermissionGranted();
        } catch {
          setHasPermission(false);
          setPermanentlyDenied(true);
        }
      }
    } catch {
      setHasPermission(false);
      setPermanentlyDenied(true);
    }
  } else {
    setHasPermission(false);
    if (isAndroidNative) {
      hasAttemptedRequest.current = true;
    }
  }
}
```

This ensures the Android system permission dialog is triggered on the very first app launch without the user needing to tap anything.

## After deploying
1. `npm run build`
2. `npx cap sync android`  
3. Run post-sync script
4. **Uninstall app from device** (`adb uninstall app.fleettrackmate.driver`) to reset permission state
5. Rebuild and install — the system dialog should now appear automatically on first launch

## Also: Fix the JDK error in the screenshot
The screenshot shows "Invalid Gradle JDK configuration found" — click the **"Use Embedded JDK"** link in Android Studio to resolve this before rebuilding.

