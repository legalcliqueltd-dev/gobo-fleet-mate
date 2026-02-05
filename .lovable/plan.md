
# Fix iOS Build Error: Missing Background Fetch Dependency

## Problem Summary
The Xcode build fails with:
```
Undefined symbols for architecture arm64:
  "_OBJC_CLASS_$_TSBackgroundFetch", referenced from: ...
```

This error occurs because `@transistorsoft/capacitor-background-geolocation` requires a peer dependency (`@transistorsoft/capacitor-background-fetch`) that is not in your `package.json`. Without this package, the iOS native linker cannot find the `TSBackgroundFetch` class.

## Root Cause
According to the official Transistorsoft documentation, **both packages must be installed together**:
```bash
npm install @transistorsoft/capacitor-background-geolocation --save
npm install @transistorsoft/capacitor-background-fetch --save
npx cap sync
```

Your `package.json` only has the first one.

---

## Solution

### Step 1: Add the Missing Dependency
I will add `@transistorsoft/capacitor-background-fetch` version `^7.1.0` (compatible with Capacitor 7.x) to the project's `package.json`.

### Step 2: You Rebuild Locally
After I add the dependency, you'll need to:

1. **Pull the updated code**:
   ```bash
   git pull
   ```

2. **Verify the dependency is present**:
   ```bash
   cat package.json | grep "capacitor-background-fetch"
   ```
   This should now output a line like:
   ```
   "@transistorsoft/capacitor-background-fetch": "^7.1.0"
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Full iOS platform reset** (recommended for clean slate):
   ```bash
   rm -rf ios
   npx cap add ios
   ./scripts/ios-post-sync.sh
   npx cap sync ios
   ```

5. **Open the correct Xcode file** (critical!):
   ```bash
   npx cap open ios
   ```
   This opens `ios/App/App.xcworkspace`. If you open `App.xcodeproj` instead, CocoaPods dependencies won't link and you'll get the same error.

6. **Clean and rebuild in Xcode**:
   - Press **⇧⌘K** (Shift+Command+K) to Clean Build Folder
   - Press **⌘R** (Command+R) to Build and Run

---

## Technical Details

### Files Changed

```text
package.json
  └── Add "@transistorsoft/capacitor-background-fetch": "^7.1.0"
```

### Why This Fixes It
The `capacitor-background-fetch` package provides the native iOS framework containing `TSBackgroundFetch.h` and its implementation. When CocoaPods runs during `npx cap sync ios`, it installs this framework into the Xcode workspace. Without the npm package, CocoaPods doesn't know to fetch it, so the linker fails.

### Version Compatibility
- `capacitor-background-geolocation@8.0.1` requires Capacitor 5+
- `capacitor-background-fetch@7.1.0` is compatible with Capacitor 5-7
- Your project uses Capacitor 7.4.x - compatible with both

---

## Verification Checklist

After completing the rebuild:

1. Xcode build completes without "TSBackgroundFetch" errors
2. App launches on iOS simulator or device
3. Location permission prompt appears when opening the driver app
4. After granting permission, the blue location indicator bar appears in iOS status bar
5. Driver appears on the admin dashboard map with live location updates
