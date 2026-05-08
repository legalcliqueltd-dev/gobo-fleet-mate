# Post-Fix Status — Action Plan Execution

- **Date**: 2026-05-08
- **Source audit**: `REPORT.md` (2026-05-05)

This file records what was changed in the codebase against the action plan in
`REPORT.md` §6, what verification was run, and what is still required from the
user before submission.

---

## Verified results

```
$ rm -rf dist && VITE_BUILD_TARGET=driver-native npx vite build
✓ 1826 modules transformed.
dist/assets/index-…js   769.93 kB │ gzip: 212.25 kB
✓ built in 2.13s

$ bash scripts/verify-native-bundle.sh
✅ Native bundle verified: no admin / marketing / subscription strings present.

$ rm -rf dist && npx vite build           # web (admin) bundle still works
dist/assets/index-…js   2,452.44 kB │ gzip: 656.93 kB
✓ built in 4.92s

$ npx tsc --noEmit                         # TypeScript clean
(no output)
```

The native bundle dropped from ~2.45 MB to ~770 kB. The forbidden strings
(`Stripe`, `Paystack`, `Subscribe Now`, `Trial Expired`, `Upgrade to Pro`,
`Pay Now`, `create-checkout`, `Rocket Driver`, `Download APK`, etc.) are all
absent.

---

## Action plan status

| ID | Action | Status | Notes |
| --- | --- | --- | --- |
| A-01 | Tree-shake admin/marketing from iOS bundle | ✅ Done | Added `VITE_BUILD_TARGET=driver-native` flag, new `src/NativeApp.tsx`, alias-based switch in `vite.config.ts`, build-gate script `scripts/verify-native-bundle.sh`. `package.json` `cap:build:ios` and `cap:build:android` now invoke the slim build and run the verifier. |
| A-02 | Build with iOS 26 SDK | ⚠️ Needs you | Cannot do from here — install Xcode 26.x, open `ios/App/App.xcworkspace`, confirm Base SDK is iOS 26. |
| A-03 | Add `PrivacyInfo.xcprivacy` | ✅ Done at file level | File at `ios/App/App/PrivacyInfo.xcprivacy`. **You must add it to the Xcode App target's Resources** (drag into the `App` group in Xcode, ensure target membership ✅). Otherwise it is not bundled into the .ipa. |
| A-04 | Driver in-app account deletion | ✅ Done | New edge action `delete-driver` in `supabase/functions/connect-driver/index.ts`. New "Delete My Account" card in `DriverAppSettings.tsx` with confirm dialog. Also adds Privacy / Terms links. **Deploy the edge function**: `npx supabase functions deploy connect-driver`. |
| A-05 | Strip demo/debug routes | ✅ Done | Removed `/demo/*`, `/admin/simulator`, `/app/diagnostics` routes from `App.tsx`. Deleted 11 unreferenced source files (BackgroundPathsDemo, HeroGeometricDemo, PulseBeamsDemo, Header3Demo, AppDemo, AppDashboard, AuthLogin, AuthSignup, LocationSimulator, LocationDiagnostics, TestSimulator). |
| A-06 | `CFBundleDisplayName` | ✅ Done | `ios/App/App/Info.plist` line 8: `gobo-fleet-mate` → `FleetTrackMate Driver`. |
| A-07 | Privacy and Terms rewrite | ✅ Done | False security claims removed (no more "End-to-end encryption" / "SOC 2" / "Penetration testing"). Generic billing language (no payment-processor names). Real entity (`Gobeth Ltd`) and contact (`gobeth.ltd@gmail.com`). Linked from `DriverAppSettings`. |
| A-08 | Trim unused permission strings | ✅ Done | Removed `NSMicrophoneUsageDescription` and `NSPhotoLibraryAddUsageDescription` from `Info.plist` and from `scripts/ios-post-sync.sh` (driver app does not record audio and does not save to library). |
| A-09 | Locale-aware emergency number | ✅ Done | New `src/utils/emergencyNumber.ts` resolves country via `Intl.DateTimeFormat().resolvedOptions().region` with `navigator.language` fallback. SOS now calls 911 in the US, 999 in the UK, 112 in EU/NG, etc. |
| A-10 | Speed-lock for driving | ✅ Done | New `src/hooks/useDrivingMode.ts`. Banner in `DriverAppLayout` shows when speed > 5 km/h. `DriverAppCompleteTask` "Complete Task" button is disabled while moving and shows a "pull over" hint. |
| A-11 | Delete duplicate config XMLs | ✅ Done | Removed `config 2.xml`, `config 3.xml`, `config 4.xml`, `config 5.xml`. The "duplicate" logo JPGs were not duplicates — they are iOS 18 light/dark/tinted icon variants and 1×/2×/3× scale variants — left in place. |
| A-12 | Replace pre-release deps | ⚠️ Skipped | Cannot do safely without functional regression risk. Replacing `react-qr-scanner@1.0.0-alpha` and `react-signature-canvas@1.1.0-alpha` with stable equivalents requires API changes that I should not make blind. Track as a follow-up. |
| A-13 | App Store Connect work | ⚠️ Needs you | Cannot do from here. Tasks: complete the 2026 age-rating questionnaire; upload driver-flow-only screenshots; fill the Privacy Nutrition Label per `privacy-deep-dive.md` §2; write App Review Notes (demo connection code, B2B / 3.1.3(f) framing, `processing` background-mode justification). |

---

## What you still need to do (in order)

1. **Deploy the new edge function action** (A-04): `npx supabase functions deploy connect-driver`. Without this, the in-app "Delete My Account" button will return a 400 error from the edge function.

2. **Add `PrivacyInfo.xcprivacy` to the Xcode target** (A-03): in Xcode, drag `ios/App/App/PrivacyInfo.xcprivacy` into the project navigator under the `App` group, and confirm in the File Inspector that the `App` target checkbox is ticked. Otherwise the file is on disk but not packaged.

3. **Build with Xcode 26** (A-02): if Xcode 26.x isn't installed, get it from developer.apple.com. Open the workspace, Product → Archive, confirm the archive's iOS Deployment Target is 14.0 and Base SDK is iOS 26.

4. **Sync to iOS** to apply the new permissions and remove the deprecated ones:
   ```
   npm run cap:build:ios
   ```
   This also runs the bundle verifier as the last step.

5. **Replace pre-release deps** (A-12) when you have time. Suggested:
   - `react-qr-scanner@1.0.0-alpha` → `@yudiel/react-qr-scanner` (active fork) or `html5-qrcode`.
   - `react-signature-canvas@1.1.0-alpha` → `react-signature-canvas` stable (`^1.0.6`) or `signature_pad` directly.

6. **App Store Connect tasks** (A-13):
   - Re-run the 2026 age-rating questionnaire.
   - Upload screenshots of: Connect screen, Driver Dashboard with map, Tasks list, SOS panel, Settings (with the new Delete button visible).
   - Privacy Nutrition Label per `privacy-deep-dive.md` §2 — Data Linked to You: Precise Location, Coarse Location, Name, User ID, Photos or Videos, Other User Content, Other Usage Data; Tracking: None.
   - App Review Notes — copy the paragraph from `section-by-section.md` §3.1.3 ("FleetTrackMate Driver is the free driver-side companion…").
   - Provide the reviewer with a sample admin code with no expiry.
   - Mention BGTaskScheduler `processing` is for Transistorsoft location-queue reconciliation; permitted identifiers are `com.transistorsoft.fetch` and `com.transistorsoft.customtask`.

---

## Files changed

```
src/App.tsx                                       (demo routes removed; old imports cleaned)
src/NativeApp.tsx                                 (NEW — driver-only entry)
src/main.tsx                                      (switches root via build-time alias)
src/vite-env.d.ts                                 (typed VITE_BUILD_TARGET)
src/utils/emergencyNumber.ts                      (NEW — locale-aware number)
src/hooks/useDrivingMode.ts                       (NEW — speed-based driving detection)
src/pages/Privacy.tsx                             (rewritten)
src/pages/Terms.tsx                               (rewritten)
src/pages/app/DriverAppSOS.tsx                    (locale-aware emergency number)
src/pages/app/DriverAppSettings.tsx               (delete-account UI + legal links)
src/pages/app/DriverAppCompleteTask.tsx           (speed-lock submit)
src/components/layout/DriverAppLayout.tsx         (driving-mode banner)
src/pages/BackgroundPathsDemo.tsx                 (DELETED)
src/pages/HeroGeometricDemo.tsx                   (DELETED)
src/pages/PulseBeamsDemo.tsx                      (DELETED)
src/pages/Header3Demo.tsx                         (DELETED)
src/pages/app/AppDemo.tsx                         (DELETED)
src/pages/app/AppDashboard.tsx                    (DELETED)
src/pages/app/AuthLogin.tsx                       (DELETED)
src/pages/app/AuthSignup.tsx                      (DELETED)
src/pages/app/LocationSimulator.tsx               (DELETED)
src/pages/app/LocationDiagnostics.tsx             (DELETED)
src/pages/app/TestSimulator.tsx                   (DELETED)
supabase/functions/connect-driver/index.ts        (added delete-driver action)
ios/App/App/Info.plist                            (CFBundleDisplayName, removed mic/photo-add)
ios/App/App/PrivacyInfo.xcprivacy                 (NEW — privacy manifest)
ios/App/App/config 2.xml … config 5.xml           (DELETED)
scripts/ios-post-sync.sh                          (matches Info.plist trim)
scripts/verify-native-bundle.sh                   (NEW — build gate)
package.json                                      (build:native, cap:verify:bundle, wired into cap:build:ios/android)
vite.config.ts                                    (alias-based driver-native entry switch)
```

---

## Re-verifying any time

```
npm run build:native     # produces dist/ from NativeApp only
npm run cap:verify:bundle  # gates: forbidden strings absent
npm run build              # web (full admin) build, still works
```

`npm run cap:build:ios` runs the build, syncs to iOS, and runs the verifier
in one step. If a future change reintroduces a forbidden string, the verifier
will block the iOS sync and surface the offending file.
