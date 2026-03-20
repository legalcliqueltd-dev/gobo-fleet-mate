

## Problem

The bash cleanup script (`scripts/android-post-sync.sh`) cannot run on your Windows machine because WSL is corrupted. The Transistorsoft plugin modules are still present in the Android build, which will cause license validation errors and interfere with the location permission prompt.

## Plan

### Step 1: Create a PowerShell cleanup script

Create `scripts/android-post-sync.ps1` that does the same thing as the bash script but runs natively on Windows PowerShell:

- Remove `transistorsoft-capacitor-background-geolocation` and `transistorsoft-capacitor-background-fetch` directories from `android/`
- Remove all lines containing "transistorsoft" from `android/settings.gradle`
- Remove all lines containing "transistorsoft" from `android/app/build.gradle`
- Remove all lines containing "transistorsoft" from `android/build.gradle`

**File**: `scripts/android-post-sync.ps1` (new)

### Step 2: Add npm script for easy execution

Add a cross-platform npm script to `package.json` so you can run `npm run cap:clean:android` after syncing.

**File**: `package.json`

---

## How to Use (After Implementation)

Run in PowerShell after `npx cap sync android`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1
```

Or if you also want to try Git Bash (comes with Git for Windows):

```bash
"C:\Program Files\Git\bin\bash.exe" scripts/android-post-sync.sh
```

### Manual Cleanup (Right Now)

While waiting for the script, you can do this **right now** in Android Studio or File Explorer:

1. **Delete these two folders** from the `android/` directory:
   - `android/transistorsoft-capacitor-background-geolocation`
   - `android/transistorsoft-capacitor-background-fetch`

2. **Edit `android/settings.gradle`** — delete any lines containing `transistorsoft`

3. **Edit `android/app/build.gradle`** — delete any lines containing `transistorsoft`

4. **Edit `android/build.gradle`** (root) — delete any lines containing `transistorsoft`

5. **Sync Gradle** in Android Studio (File > Sync Project with Gradle Files)

6. **Rebuild** the APK

