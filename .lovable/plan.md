

## Plan: Fix Post-Sync Script to Clean All Gradle Files

### Problem
The Transistorsoft references persist in `android/capacitor.settings.gradle` because the cleanup script only targets `android/app/capacitor.settings.gradle` — but in Capacitor 7, this file is at the **root** `android/` level.

### Fix

**Update `scripts/android-post-sync.ps1`** — add root-level Capacitor gradle files to the cleanup list:

```
$filesToClean = @(
    "$AndroidDir\settings.gradle",
    "$AndroidDir\build.gradle",
    "$AndroidDir\app\build.gradle",
    "$AndroidDir\app\capacitor.settings.gradle",
    "$AndroidDir\app\capacitor.build.gradle",
    "$AndroidDir\capacitor.settings.gradle",      # <-- NEW
    "$AndroidDir\capacitor.build.gradle"           # <-- NEW
)
```

**Update `scripts/android-post-sync.sh`** — same fix for the Bash variant, adding the two root-level paths to the `for` loop.

### After applying
Re-run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1
```
Then verify with:
```powershell
Select-String -Path "android\settings.gradle","android\capacitor.settings.gradle" -Pattern "transistorsoft"
```

### Files changed
- `scripts/android-post-sync.ps1`
- `scripts/android-post-sync.sh`

