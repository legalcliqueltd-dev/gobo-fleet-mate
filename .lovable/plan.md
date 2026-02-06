
# Fix: iOS Camera Crash — Missing NSCameraUsageDescription

## Root Cause (Confirmed by Xcode)

The crash log explicitly states:

> "The app's Info.plist must contain an NSCameraUsageDescription key with a string value"

This means the `NSCameraUsageDescription` entry is **not present** in the running app's Info.plist, even though we have a script designed to add it.

---

## Problem with Current Script

The script at `scripts/ios-post-sync.sh` uses a `sed` command that replaces the **first** `</dict>` it finds. However, iOS Info.plist files typically have **nested** `<dict>` elements, so the camera permission might be getting inserted inside a child dictionary (like inside `UIRequiredDeviceCapabilities`) instead of the root `<dict>`.

---

## Solution

### 1. Fix the ios-post-sync.sh Script

Replace the fragile `sed`-based insertion with Apple's native `PlistBuddy` tool, which is guaranteed to work correctly on macOS:

```bash
# Instead of sed-based insertion:
/usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string 'FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof.'" "$PLIST_PATH" 2>/dev/null || true
```

`PlistBuddy` adds keys to the **root** of the plist file reliably.

### 2. Full Script Rewrite

```text
scripts/ios-post-sync.sh
```

The updated script will:
- Use `PlistBuddy` for all key insertions (more reliable than sed)
- Check if each key already exists before adding
- Print clear verification output showing all added permissions
- Handle the `UIBackgroundModes` array properly

### 3. Manual Immediate Fix (For You to Do Right Now)

While we update the script, you can fix this immediately in Xcode:

1. Open `ios/App/App/Info.plist` in Xcode
2. Click the `+` button at the root level
3. Add these keys with their values:

| Key | Type | Value |
|-----|------|-------|
| `NSCameraUsageDescription` | String | FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof. |
| `NSPhotoLibraryUsageDescription` | String | FleetTrackMate needs photo library access to select photos and videos for emergency reports and delivery proof. |
| `NSPhotoLibraryAddUsageDescription` | String | FleetTrackMate needs permission to save captured media to your library. |
| `NSMicrophoneUsageDescription` | String | FleetTrackMate needs microphone access when recording delivery proof videos. |

4. Clean Build (⇧⌘K) → Run (⌘R)

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/ios-post-sync.sh` | Rewrite to use PlistBuddy instead of sed |

---

## Verification Steps

After adding the keys (either manually or via updated script):

1. In Xcode, open `ios/App/App/Info.plist`
2. Search for "Camera" — you should see `NSCameraUsageDescription`
3. Clean Build (⇧⌘K)
4. Run (⌘R)
5. Tap the camera button — the native iOS permission prompt should appear

---

## Why This Will Work

- **PlistBuddy** is Apple's official plist manipulation tool
- It correctly handles nested dictionaries and arrays
- It's pre-installed on all Macs with Xcode
- The keys will be added to the root level of the plist, not nested inside child elements

---

## Quick Manual Test (Right Now)

Before we even update the script, you can verify the fix works by manually adding `NSCameraUsageDescription` in Xcode:

1. In Xcode, open `ios/App/App/Info.plist`
2. Right-click on "Information Property List" (the root)
3. Choose "Add Row"
4. Type `NSCameraUsageDescription`
5. Set value to: `FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof.`
6. ⇧⌘K (Clean) → ⌘R (Run)
7. Test the camera button

If the camera works after this manual addition, we know the script fix is the correct solution.
