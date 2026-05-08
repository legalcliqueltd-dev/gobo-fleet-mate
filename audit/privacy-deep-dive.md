# Privacy Deep-Dive

## 1. NSUsageDescription audit

Each purpose string must be specific and honestly describe the use. ✅ all current strings pass that bar; below is a verdict per key.

| Key | String (current) | Verdict | Comment |
| --- | --- | --- | --- |
| `NSCameraUsageDescription` | "FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof." | ✅ | Specific. Both uses present in code. |
| `NSPhotoLibraryUsageDescription` | "FleetTrackMate needs photo library access to select photos and videos for emergency reports and delivery proof." | ✅ | Specific. Used by SOS gallery picker and CompleteTask. |
| `NSPhotoLibraryAddUsageDescription` | "FleetTrackMate needs permission to save captured media to your library." | ⚠️ | I could not find a code path that calls `saveToGallery` or writes to the Photos library. The Capacitor camera config has `saveToGallery: false` (`src/utils/nativeCamera.ts:84`). **If you don't actually save to the library, remove this key** — Apple flags purpose strings for capabilities you don't exercise. |
| `NSMicrophoneUsageDescription` | "FleetTrackMate needs microphone access when recording delivery proof videos." | ⚠️ | Only conditionally used in CompleteTask. Verify there is at least one shipped flow that captures video; if video recording was descoped, drop this string and the entitlement. Apple has rejected apps for asking for unused permissions. |
| `NSMotionUsageDescription` | "FleetTrackMate uses motion data to optimize battery usage during location tracking." | ✅ | Transistorsoft uses Core Motion. |
| `NSLocationWhenInUseUsageDescription` | "FleetTrackMate needs your location to share your position with your fleet manager." | ✅ | Specific and honest. |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | "FleetTrackMate needs continuous location access to track your position even when the app is in the background." | ✅ | Specific. Make sure the runtime flow first requests WhenInUse and then escalates to Always with context (Apple's preferred pattern; Capacitor's geolocation does this). |

## 2. App Privacy "Nutrition Label" — what to declare in App Store Connect

Apple's data type taxonomy and what this app collects:

| Data Type | Collected? | Linked to user? | Used for tracking? | Purpose |
| --- | --- | --- | --- | --- |
| Contact Info — Name | ✅ Yes (driver name in DriverSession) | ✅ Yes | ❌ No | App Functionality |
| Contact Info — Email | ❌ No (drivers don't enter email) | — | — | — |
| Contact Info — Phone | ❌ No | — | — | — |
| Contact Info — Physical Address | ❌ No | — | — | — |
| Health & Fitness | ❌ No | — | — | — |
| Financial Info | ❌ No (subscriptions are web-only) | — | — | — |
| Location — Precise | ✅ Yes (real-time GPS, +- 10 m) | ✅ Yes (linked to driver record) | ❌ No | App Functionality (fleet tracking) |
| Location — Coarse | ✅ Yes (derived) | ✅ Yes | ❌ No | App Functionality |
| Sensitive Info | ❌ No | — | — | — |
| Contacts | ❌ No | — | — | — |
| User Content — Photos / Videos | ✅ Yes (SOS evidence, delivery proof) | ✅ Yes | ❌ No | App Functionality |
| User Content — Other (signature) | ✅ Yes | ✅ Yes | ❌ No | App Functionality |
| Browsing History | ❌ No | — | — | — |
| Search History | ❌ No | — | — | — |
| Identifiers — User ID | ✅ Yes (`driverId`, an internal Supabase UUID) | ✅ Yes | ❌ No | App Functionality |
| Identifiers — Device ID (IDFA, IDFV) | ❌ No detected — but verify Capacitor / Transistorsoft don't call `ASIdentifierManager`. If they do, must declare and prompt ATT. | — | — | — |
| Purchases | ❌ No | — | — | — |
| Usage Data — Product Interaction | ⚠️ Maybe (driver heartbeats, on-duty toggle, battery level sent every 60 s — `DriverAppDashboard.tsx:213-226`) | ✅ Yes | ❌ No | App Functionality / Analytics |
| Diagnostics — Crash, Performance | ❌ No external crash reporter detected | — | — | — |
| Other Data — Battery level, Signal accuracy, Speed/heading | ✅ Yes | ✅ Yes | ❌ No | App Functionality |

Recommended Nutrition Label categories:
- **Data Linked to You**: Precise Location, Coarse Location, Name, User ID, Photos or Videos, Other User Content, Other Usage Data.
- **Data Not Linked to You**: none confirmed.
- **Tracking**: **none** — no data is shared with third parties for tracking purposes (no ad SDKs, no cross-app linking).

## 3. Third-party SDKs and PrivacyInfo.xcprivacy

Apple now requires apps and certain third-party SDKs to ship a `PrivacyInfo.xcprivacy` file declaring:
- Required Reasons API usage (e.g., `NSPrivacyAccessedAPICategoryUserDefaults`).
- Third-party tracking domains.
- Data types collected.

| Item | Status | Action |
| --- | --- | --- |
| App-level `PrivacyInfo.xcprivacy` in `ios/App/App/` | ❌ Missing | **Add it.** Even if every dependency ships its own manifest, your app should ship one declaring at least `NSPrivacyAccessedAPICategoryUserDefaults` (Capacitor and most React apps touch `NSUserDefaults` via Capacitor preferences) and `NSPrivacyAccessedAPICategoryFileTimestamp` (file system access). |
| `Capacitor.framework` / `CapacitorCordova.framework` | ⚠️ Verify | Recent Capacitor versions ship a privacy manifest. Confirm in `node_modules/@capacitor/ios/Capacitor/Capacitor/PrivacyInfo.xcprivacy`. |
| `@capacitor/camera` | ⚠️ Verify | Should declare camera + photo library access. |
| `@capacitor/geolocation` | ⚠️ Verify | Should declare location. |
| `TransistorsoftCapacitorBackgroundGeolocation` (Pod) | ⚠️ Verify | Background location, motion. |
| `TransistorsoftCapacitorBackgroundFetch` | ⚠️ Verify | BGTaskScheduler usage. |
| `CocoaLumberjack` (transitively included by Transistorsoft) | ⚠️ Verify | Uses file timestamps for log files — must declare `NSPrivacyAccessedAPICategoryFileTimestamp`. |
| `IONGeolocationLib` (Capacitor's Ionic geolocation lib) | ⚠️ Verify | — |

**To check what's installed:** `find ios/App/Pods -name "PrivacyInfo.xcprivacy" -print` after `pod install`.

**Required app-level PrivacyInfo.xcprivacy template** (drop in `ios/App/App/PrivacyInfo.xcprivacy` and add to the Xcode `App` target):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePreciseLocation</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePhotosorVideos</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeName</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeUserID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>E174.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

Verify each Reason code matches an actual use; the values above are the most common safe defaults. Reference: <https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api>.

## 4. App Tracking Transparency (ATT)

❌ **Not required, and must NOT be added unless you start tracking.** No tracking SDK is currently bundled. If you later add Firebase Analytics, Facebook SDK, Adjust, AppsFlyer, etc., you must:
1. Add `NSUserTrackingUsageDescription` to Info.plist with a clear reason.
2. Call `ATTrackingManager.requestTrackingAuthorization` before any tracking.
3. Update the Privacy Nutrition Label to set `Tracking: Yes` for the relevant data types.

## 5. COPPA / kids

❌ **Not collecting from users under 13 by design**. The app is for working drivers (typically 18+). Set the App Store age rating accordingly via the new 2026 questionnaire (likely 12+ given the SOS hazard categories include "robbery/medical"; a reviewer might bump to 17+ for "Infrequent/Mild Realistic Violence" depending on how SOS is labeled).

## 6. Account deletion

⚠️ **Required by 5.1.1(v)**. Current state:
- Web-side: `/delete-account` page works for Supabase users; submits an email request, deletes after 7 days. Apple requires deletion to be processed in-app and "as easy as account creation." The email-and-wait approach is borderline; reviewers may accept it but typically expect immediate deletion or a clear "your account will be deleted within X days" message.
- iOS-side (driver app): **no deletion path exists**. The DriverSession is a localStorage record; user can "Disconnect" (clearing local data) but the server-side `drivers` row persists. Apple's interpretation: any "user-identifiable record" must be deletable.

**Action**: add a "Disconnect & Delete My Profile" button in `DriverAppSettings.tsx` that:
1. Calls a new edge function (or extend `connect-driver`) that deletes the driver row and any historical locations / SOS / proofs the driver alone owns.
2. Calls `disconnect()` from `DriverSessionContext`.
3. Shows a confirmation toast.

## 7. Privacy policy in-app accessibility

⚠️ **Reachable but not linked from driver UI**. Add a "Privacy Policy" / "Terms" link in `DriverAppSettings.tsx`. Externally open the policy URL via `Browser.open` from `@capacitor/browser` (currently absent — would need to add this plugin) **OR** route to the existing in-app `/privacy` page. The latter avoids adding a plugin and keeps the policy onscreen inside the app shell.

## 8. Privacy policy text accuracy

⚠️ **Verify or remove these claims** in `Privacy.tsx`:
- "End-to-end encryption for all data transmission" — TLS != E2E. If you mean TLS, say TLS.
- "SOC 2 compliant infrastructure and processes" — only true if you've completed a SOC 2 audit; Supabase's underlying infrastructure being SOC 2 compliant does not transfer.
- "Regular security audits and penetration testing" — only true if you do this.

False security claims have caused FTC complaints in the US (e.g., Snap's "disappearing messages" case) and are independently risky.

Replace with truthful language about Supabase's hosting, TLS in transit, RLS authorization, and the actual data lifecycle.
