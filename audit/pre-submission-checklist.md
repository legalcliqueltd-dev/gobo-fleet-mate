# Pre-Submission Checklist

| ID | Check | Status | Evidence / Action |
| --- | --- | --- | --- |
| C-01 | Built against required SDK (iOS 26 SDK from 2026-04-28) | ⚠️ Verify | Open Xcode, select target App → Build Settings → Base SDK should read **iOS 26.0** or later. Project Pods build with `IPHONEOS_DEPLOYMENT_TARGET = 14.0` — that's the minimum runtime, not the build SDK. Update Xcode to 26.x if needed. |
| C-02 | No placeholder text / lorem ipsum / TODO in user-facing strings | ❌ Fail in source, ✅ in bundle (verified) | Source has "Coming in Phase 2/3/4" in `AuthLogin.tsx`, `AuthSignup.tsx`, `AppDashboard.tsx`, `AppDemo.tsx`. A `grep` of `dist/assets/*.js` shows these strings did not bundle — likely because no `App.tsx` route imports them. Still, **delete these unreachable files** to avoid future accidental routing. |
| C-03 | Stripe/Paystack/Pricing strings absent from iOS JS bundle | ❌ **Fail** | `dist/assets/index-CDYCFu0M.js` contains: `Stripe`, `Paystack`, `Pay Now`, `Subscribe`, `Trial Expired`, `Upgrade to Pro`. Tree-shake or feature-flag these out (see Action Plan A-01). |
| C-04 | No Android / Play Store / APK references in iOS bundle | ❌ **Fail** | `dist/assets/index-CDYCFu0M.js` contains: `Android`, `APK`, `Rocket Driver`. Source: `src/components/AppDownload.tsx` (rendered in Landing). Tree-shake. |
| C-05 | No broken features, dead buttons, crash-on-launch | ⚠️ Verify | Test on device. Known stub: `src/pages/app/AuthLogin.tsx` and `AuthSignup.tsx` are fully disabled; not registered in App.tsx routes, but their files are present. Delete. |
| C-06 | Demo account credentials prepared | ⚠️ Pending | Driver app uses code-based connection — provide reviewer with: a sample admin code, your name to enter, and the expected dashboard URL. Add to App Review Notes in App Store Connect. |
| C-07 | Privacy policy URL reachable and matches actual practices | ❌ **Fail** | (a) `Privacy.tsx` makes false claims ("End-to-end encryption", "SOC 2"). Replace. (b) Policy URL is presumably `https://fleettrackmate.com/privacy` — verify it's live and identical to in-app text. (c) Add a link to the policy from the **driver app** UI (currently only reachable from web admin nav). |
| C-08 | Terms of use accessible from within the app (required if subscriptions) | ➖ N/A in iOS app | Subscriptions are web-only; iOS app should still link Terms from `DriverAppSettings`. |
| C-09 | Restore Purchases button (if IAP) | ➖ N/A | No IAP. |
| C-10 | Subscription pricing/duration/renewal disclosed pre-purchase | ➖ N/A | iOS app does not sell. |
| C-11 | No mentions of other platforms in user-facing UI | ❌ **Fail** | "Android", "APK", "Rocket Driver" in bundle. See C-04. |
| C-12 | App icon, screenshots, description match content | ⚠️ Pending | Screenshots not yet uploaded. Use driver-flow screenshots: Connect screen, Dashboard with map, Tasks list, SOS panel, Settings. Do **not** include admin dashboard screenshots. |
| C-13 | New 2026 age-rating questionnaire completed by 2026-01-31 | ⚠️ Verify | Re-do in App Store Connect → App Information. Honest answers: location tracking yes; UGC visible to others no; in-app purchases no; medical/legal/violent themes no; "infrequent/mild realistic violence" possibly yes if "Robbery" SOS hazard counts (probably 12+ not 17+). |
| C-14 | `CFBundleDisplayName` is correct | ❌ **Fail** | Currently `gobo-fleet-mate`. Change to `FleetTrackMate Driver` (or whatever the App Store listing says). |
| C-15 | Capacitor sync produced clean Info.plist | ⚠️ | Stale `config 2.xml`–`config 5.xml` files in `ios/App/App/`. Delete. Also delete duplicate logo JPGs in `Assets.xcassets/AppIcon.appiconset/` if not referenced. |
| C-16 | `BGTaskSchedulerPermittedIdentifiers` declared | ✅ | Added in this session: `com.transistorsoft.fetch`, `com.transistorsoft.customtask`. |
| C-17 | `PrivacyInfo.xcprivacy` shipped | ❌ **Fail** | App-level manifest missing. Only `TSBackgroundFetch` framework ships its own. See `privacy-deep-dive.md` for the template to add. |
| C-18 | Account deletion in-app | ❌ **Fail** | Driver iOS app has no deletion button. Add to `DriverAppSettings.tsx` (see Action Plan A-04). |
| C-19 | Live backend during review | ⚠️ Verify | Supabase project must remain live; `connect-driver`, `sos-create`, all edge functions must respond. Test from a fresh device with no cached state. |
| C-20 | Demo connection code stays valid for the review window | ⚠️ Verify | Apple review can take 1–7 days. Issue a code with no expiry or a 30-day window. |
| C-21 | App functions on a clean install (first-time flow) | ⚠️ Verify | Wipe simulator + device, install, walk through Connect → permission prompts → On Duty → SOS test. |
| C-22 | App functions without an internet connection (graceful degradation) | ⚠️ Verify | Trail-sync logic in `DriverAppDashboard.tsx:228-260` queues offline; verify the app is usable (or shows a clear message) with airplane mode. |
| C-23 | App handles permission denial gracefully | ✅ | `LocationBlocker` component blocks but does not crash. |
| C-24 | App responds to runtime errors without blank screens | ✅ | `App.tsx:64-71` adds an `unhandledrejection` listener and `ErrorBoundary` is present. |
| C-25 | Universal-link / `tel:` / external URL handlers behave | ⚠️ Verify | `tel:112` works only outside the US. Consider locale-aware emergency number (911 / 999 / 112). |
| C-26 | App Privacy Nutrition Label updated in App Store Connect | ⚠️ Pending | See `privacy-deep-dive.md` §2 for the recommended set. |
| C-27 | NSPhotoLibraryAdd and NSMicrophone are actually used | ⚠️ At risk | Both declared but underused. Either exercise them (video proof flow, save-to-library) or remove. Apple has rejected apps for declaring purpose strings for unused capabilities. |
| C-28 | App icon meets HIG (no transparency, no rounded corners pre-applied, 1024 master) | ⚠️ Verify | `Assets.xcassets/AppIcon.appiconset/` has 3 JPGs named "FLEETTRACKMATE LOGO 1.jpg" etc. JPGs typically work but Apple recommends PNG with no alpha. Use the 1024×1024 master and let Xcode generate the rest, or check `Contents.json` is correctly mapping sizes. |
| C-29 | App rejects screenshots that show payment / Android references | ❌ Implicit fail unless C-03/C-04 fixed | — |
| C-30 | Support URL is reachable | ⚠️ Verify | Use `https://fleettrackmate.com/support` or a `mailto:` linking to `gobeth.ltd@gmail.com` or whatever is the real support channel. The current `privacy@gftm.com` / `legal@gftm.com` need verification. |
