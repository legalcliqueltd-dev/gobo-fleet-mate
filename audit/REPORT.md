# FleetTrackMate Driver — App Store Compliance Audit

- **App**: FleetTrackMate Driver (`app.fleettrackmate.driver`)
- **Audit date**: 2026-05-05
- **Guidelines snapshot**: 2026-05-05 (see `guidelines-snapshot.md`)
- **Scope**: iOS / iPadOS native bundle only (web admin dashboard out of scope)

---

## 1. Executive Summary

**Overall risk: HIGH — likely rejected as currently bundled.**

The app's *behavior* is largely defensible: a free driver-side companion to a paid web fleet-management product, using location, camera, and BGTaskScheduler for legitimate purposes. The problem is the **iOS JavaScript bundle still ships the admin/marketing surfaces** (Stripe + Paystack subscription UI, "Download APK" instructions, "Rocket Driver" branding, trial-expired flows). A reviewer doesn't have to navigate there for the bundle to fail keyword scans; the strings are visible to App Review's automated tooling and any deep-link probe.

### Top three blockers

1. **Subscription / external-payment surfaces in the iOS bundle (Guideline 3.1.1)** — `PaymentWall`, `PaymentModal`, `Pricing`, and the `AppLayout` "Upgrade Now" banner all bundle into the iOS build. They open Stripe / Paystack checkouts via `window.open`. To rely on the 3.1.3(f) "free stand-alone companion" defense, *no* purchase UI may exist in the iOS app. Currently it does.
2. **Other-platform mentions in the iOS bundle (Guideline 2.3.10)** — `AppDownload.tsx` (rendered by `Landing`) ships strings like "Download FleetTrackMate Driver APK", "Android 8.0+ required", "Enable Install from unknown sources", and the alternate brand "Rocket Driver". `dist/assets/index-CDYCFu0M.js` was confirmed to contain these literal strings.
3. **Required SDK & privacy-manifest gaps (Guidelines 2.5.1 & 5.1.2)** — Apple requires uploads to use the iOS 26 SDK from 2026-04-28 (5 days ago). No `PrivacyInfo.xcprivacy` ships at the app level. No app-level entitlements file exists.

### Realistic disposition

If you ship today: rejection on 3.1.1 (and likely 2.3.10 too) is near-certain.

If you fix the three blockers and the privacy / display-name issues, this is a **submittable B2B driver companion app** that plausibly passes review. The architecture is correct; the build pipeline simply doesn't tree-shake admin-only code from the native bundle.

---

## 2. Blocker issues (ordered by severity)

### B-01 — Subscription / IAP-bypass surfaces bundled into iOS

**Guideline**: 3.1.1 In-App Purchase / 3.1.3(f) Free Stand-alone Apps.

**Evidence**:
- `src/components/PaymentWall.tsx:121` — `window.open(data.url, "_blank")` to a Stripe / Paystack URL returned from `create-checkout` / `create-paystack-checkout` edge functions.
- `src/components/PaymentModal.tsx:107` — same.
- `src/components/Pricing.tsx:103-178` — pricing CTA "Pay Now · Skip Trial".
- `src/components/layout/AppLayout.tsx:78-82` — "Upgrade Now" banner.
- `dist/assets/index-CDYCFu0M.js` confirmed to contain literal strings `Stripe`, `Paystack`, `Pay Now`, `Subscribe`, `Trial Expired`, `Upgrade to Pro`.

**Why it fails**: even without a CTA reachable from the driver `/app/*` flow, App.tsx still registers `/dashboard`, `/auth/login`, `/auth/signup` etc. on native (App.tsx:144-345 — only the catch-all redirects unknown paths). A reviewer logging in through `/auth/login` would land on the admin AppLayout with the "Upgrade Now" banner, and could be redirected to Stripe outside StoreKit. Even if not reached, the strings are scannable.

**Fix (S–M effort, ~4 hours)**: split the build with a Vite mode flag:

```ts
// vite.config.ts
const isDriverNative = process.env.BUILD_TARGET === 'driver-native';
// ...
plugins: [
  react(),
  isDriverNative && replace({
    'process.env.BUILD_TARGET': JSON.stringify('driver-native'),
  }),
]
```

Then in `App.tsx`, gate every non-`/app/*` route behind `import.meta.env.BUILD_TARGET !== 'driver-native'`. Lazy-import `Landing`, `Pricing`, `AppLayout`, `PaymentWall`, `PaymentModal` so Rollup tree-shakes them. Update `npm run cap:build:ios` to set `BUILD_TARGET=driver-native`.

After the fix, run `grep -E "(Stripe|Paystack|Subscribe|Trial Expired|Upgrade to Pro|APK|Android|Rocket Driver)" dist/assets/*.js` and confirm zero matches.

### B-02 — Other-platform / sideload references in the iOS bundle

**Guideline**: 2.3.10.

**Evidence**:
- `src/components/AppDownload.tsx:8` — APK download URL.
- `src/components/AppDownload.tsx:54` — "FleetTrackMate Driver APK".
- `src/components/AppDownload.tsx:121-124` — Android sideload instructions.
- `src/components/AppDownload.tsx:33` — "Download Rocket Driver" (alternate brand).
- `dist/assets/index-CDYCFu0M.js` confirmed to contain `Android`, `APK`, `Rocket Driver`.

**Fix (S, ~30 min)**: same tree-shake strategy as B-01 — `AppDownload` is rendered only inside `Landing`, so excluding `Landing` from the native build removes it. Confirm with the same grep.

### B-03 — Build SDK requirement (iOS 26 from 2026-04-28)

**Guideline**: 2.5.1.

**Evidence**: `Podfile:3` sets `platform :ios, '14.0'` (deployment target — that's fine). `project.pbxproj` shows `IPHONEOS_DEPLOYMENT_TARGET = 14.0`. The build SDK is whatever Xcode you launch — verify this is 26.x.

**Fix (S, depends on whether Xcode 26 is installed)**: install Xcode 26.x, open the project, ensure Base SDK / Build Settings show iOS 26. Re-archive.

### B-04 — Missing `PrivacyInfo.xcprivacy`

**Guideline**: 5.1.2 (privacy disclosure) + Apple's Required Reasons API policy.

**Evidence**: `find ios/App/App -name 'PrivacyInfo.xcprivacy'` returns nothing. Only `TSBackgroundFetch.xcframework` ships its own.

**Fix (S, ~30 min)**: add the file at `ios/App/App/PrivacyInfo.xcprivacy` per the template in `privacy-deep-dive.md` §3, and reference it in the Xcode App target's Resources.

### B-05 — `CFBundleDisplayName` is `gobo-fleet-mate`

**Guideline**: 2.3.7 unique app name.

**Evidence**: `ios/App/App/Info.plist:7-8`.

**Fix (S, ~5 min)**: change to `FleetTrackMate Driver` (matching `capacitor.config.ts:19`).

### B-06 — In-app account deletion missing in driver iOS flow

**Guideline**: 5.1.1(v).

**Evidence**: `DriverAppSettings.tsx` has no deletion button. `/delete-account` requires Supabase auth and won't help drivers.

**Fix (M, ~2 hours)**: add a "Disconnect & Delete My Profile" button that:
1. Calls a new edge-function action (extend `connect-driver`) that hard-deletes the driver row, locations, and SOS evidence.
2. Calls `disconnect()` from `DriverSessionContext`.
3. Returns to the Connect screen with a confirmation toast.

### B-07 — Inaccurate / placeholder developer information

**Guideline**: 1.5 Developer Information.

**Evidence**: `Privacy.tsx:128-130` and `Terms.tsx:138-140` show `privacy@gftm.com` / `legal@gftm.com` and a fictional San Francisco address.

**Fix (S, ~10 min)**: replace with the real contact email (`gobeth.ltd@gmail.com` or a corporate alias) and real registered address. If the entity is a UK or NG limited company, use the registered office.

### B-08 — Inaccurate security claims in privacy policy

**Guidelines**: 1.5, 5.1.1(i), 1.6 — and FTC consumer-protection law.

**Evidence**: `Privacy.tsx:33-37`: "End-to-end encryption", "SOC 2 compliant", "Regular penetration testing".

**Fix (S, ~30 min)**: rewrite to truthful claims about Supabase TLS, Row-Level Security, retention, and your actual security practices.

---

## 3. Risk issues (may trigger rejection or reviewer questions)

### R-01 — Demo / debug routes still registered

`/demo/background-paths`, `/demo/hero-geometric`, `/demo/pulse-beams`, `/demo/header-3`, `/admin/simulator`, `/app/diagnostics`. Reviewers may ping any of these. Strip from production routes (Action A-05).

### R-02 — Driver dashboard auto-tilts and rotates the map at speed > 5 km/h

`DriverAppDashboard.tsx:165-176`. Apple watches for "encouraging device use that risks physical harm." Add a passive driving-mode hint and ensure no input prompts appear while moving.

### R-03 — `tel:112` is region-specific

Won't connect in the US (911) or UK (999). Add a small lookup or just route to iOS's "Emergency" sheet via a generic `tel:` to the user's country.

### R-04 — `NSPhotoLibraryAddUsageDescription` & `NSMicrophoneUsageDescription` declared but lightly used

Either ship the video-recording flow that uses them, or remove the keys from Info.plist (and the post-sync script) to avoid an "unused permission" challenge.

### R-05 — Pre-release npm dependencies in production-critical paths

`react-qr-scanner@1.0.0-alpha`, `react-signature-canvas@1.1.0-alpha`. Replace with stable equivalents.

### R-06 — Driver session in unencrypted `localStorage`

Acceptable but document in privacy policy. For higher security, store `adminCode` in Capacitor Preferences with iOS Keychain backing (`@capacitor/preferences` does not use Keychain by default; `capacitor-secure-storage-plugin` does).

### R-07 — `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone + iPad) without iPad-specific layouts

Either drop iPad ("1") or add iPad layouts. Letterboxing without testing may produce reviewer screenshots that look broken.

### R-08 — Privacy policy not linked from driver app UI

Add a "Privacy" / "Terms" footer link to `DriverAppSettings.tsx`.

### R-09 — Stale duplicate config files in `ios/App/App/`

`config 2.xml`–`config 5.xml`, plus duplicate logo JPGs in `Assets.xcassets/AppIcon.appiconset/`. Delete to keep the bundle clean and prevent any unintended inclusion.

### R-10 — UGC moderation path

SOS / delivery-proof submissions are private to the dispatcher, but mention this clearly in App Review Notes to forestall a 1.2 question.

### R-11 — Background `processing` mode triggers extra reviewer scrutiny

Document in App Review Notes that BGTaskScheduler `processing` is used by Transistorsoft to flush queued location points after motion ends; identifiers `com.transistorsoft.fetch` and `com.transistorsoft.customtask`.

### R-12 — Age-rating questionnaire (new 2026 system, due 2026-01-31)

Re-answer in App Store Connect. Likely 12+ (location tracking + occasional realistic-violence-adjacent SOS hazard categories) or 17+ depending on how strict you are with the new "creator app" vs "fleet productivity" classification.

---

## 4. Polish recommendations (non-blocking)

- P-01 — Move admin contact email off `gftm.com` to a domain you own (probably `fleettrackmate.com`).
- P-02 — Add "Privacy", "Terms", and "Help / Contact" links to the driver app footer.
- P-03 — Add a `CFBundleShortVersionString` of `1.0.0` (currently `1.0`); App Store Connect prefers semver.
- P-04 — Strip `lovable-tagger` from `devDependencies` if not used.
- P-05 — Delete unused source files (`AuthLogin.tsx`, `AuthSignup.tsx`, `AppDashboard.tsx`, `AppDemo.tsx`, demo pages) to reduce maintenance and audit surface.
- P-06 — Generate native iOS app icon from the 1024 master via Xcode rather than committing 3 JPG copies.
- P-07 — Run `npx cap doctor` and resolve any warnings.
- P-08 — Consider replacing Google Maps with Apple Maps (`MapKit JS`) for an iOS-native feel; not required.

---

## 5. Section-by-section verdict table

| Section | Verdict | Severity if non-compliant |
| --- | --- | --- |
| 1.1.1 Defamation | ➖ N/A | — |
| 1.1.2 Realistic violence | ➖ N/A | — |
| 1.1.3 Weapons | ➖ N/A | — |
| 1.1.4 Pornographic | ➖ N/A | — |
| 1.1.5 Religious | ➖ N/A | — |
| 1.1.6 False info / fake location | ⚠️ Risk (LocationSimulator bundled) | Low |
| 1.1.7 Tragedy profiteering | ➖ N/A | — |
| 1.2 UGC | ⚠️ Disclose private nature in Review Notes | Low |
| 1.3 Kids Category | ➖ N/A | — |
| 1.4.1 Medical accuracy | ➖ N/A | — |
| 1.4.5 Risky activity | ⚠️ Map auto-tilt while driving | Medium |
| 1.5 Developer info | ⚠️ Placeholder addresses | Medium |
| 1.6 Data security | ⚠️ Pre-release deps | Low |
| 1.7 Reporting crime | ⚠️ SOS framing | Low |
| 2.1 App completeness | ❌ Phase-2 placeholder source files (not bundled) + stub pages | High |
| 2.3.7 Unique name | ❌ `gobo-fleet-mate` display name | High |
| 2.3.10 No other-platform | ❌ APK / Android / Rocket Driver in bundle | **Blocker** |
| 2.4.1 iPhone runs on iPad | ⚠️ | Medium |
| 2.4.2 Battery / heat | ⚠️ Acceptable with On/Off Duty | Low |
| 2.5.1 Public APIs / current SDK | ❌ Verify Xcode 26 build | **Blocker** |
| 2.5.4 Background modes | ⚠️ Document `processing` use | Low |
| 2.5.14 Recording user activity | ✅ iOS indicator visible | — |
| 3.1.1 IAP | ❌ Stripe / Paystack reachable in iOS bundle | **Blocker** |
| 3.1.3(f) Stand-alone companion | Pending fix of 3.1.1 | — |
| 4.1 Copycats | ✅ | — |
| 4.2 Minimum functionality | ✅ | — |
| 4.5.4 Push | ➖ N/A | — |
| 4.7 Mini apps | ➖ N/A | — |
| 4.8 Login services | ✅ Code-based session, no third-party SSO | — |
| 4.9 Apple Pay | ➖ N/A | — |
| 4.10 Monetizing built-ins | ✅ | — |
| 5.1.1(i) Privacy policy | ⚠️ Not linked from driver UI; false claims | Medium |
| 5.1.1(iii) Data minimization | ✅ | — |
| 5.1.1(v) Account deletion | ❌ No driver-side deletion | High |
| 5.1.2(i) ATT | ✅ N/A (no tracking SDK) | — |
| 5.1.3 Health | ➖ N/A | — |
| 5.1.4 Kids | ➖ N/A | — |
| 5.1.5 Location | ⚠️ Don't market SOS as 911-equivalent | Low |
| 5.2 IP | ⚠️ Confirm trademark | Low |
| 5.3 Gambling | ➖ N/A | — |
| 5.4 VPN | ➖ N/A | — |
| 5.5 MDM | ➖ N/A | — |

---

## 6. Action plan (ordered, with effort estimates)

| # | Action | Effort | Files / surfaces |
| --- | --- | --- | --- |
| **A-01** | **Tree-shake admin/marketing code from iOS bundle.** Add `BUILD_TARGET=driver-native` flag. Lazy-import `Landing`, `Pricing`, `PaymentWall`, `PaymentModal`, `AppDownload`, `AppLayout`, `Dashboard`, `auth/Login`, `auth/Signup`, etc. Gate or remove non-`/app/*` routes when flag is set. Verify with `grep -E '(Stripe\|Paystack\|Subscribe\|APK\|Android\|Rocket Driver\|Trial Expired)' dist/assets/*.js` returning empty. | M (4 h) | `vite.config.ts`, `src/App.tsx`, `package.json` (`cap:build:ios` script) |
| **A-02** | **Build with iOS 26 SDK.** Install Xcode 26.x; open the project; verify Base SDK; clean & archive. | S (1 h, mostly download) | none (build env) |
| **A-03** | **Add `PrivacyInfo.xcprivacy`** at `ios/App/App/PrivacyInfo.xcprivacy` per template in `privacy-deep-dive.md` §3. Add to App target Resources in Xcode. | S (30 min) | `ios/App/App/PrivacyInfo.xcprivacy` (new) |
| **A-04** | **Add driver account deletion.** New `DriverAppSettings.tsx` button → new `connect-driver` action `'delete-driver'` that hard-deletes the driver row + cascading data → call `disconnect()` → toast. | M (2 h) | `src/pages/app/DriverAppSettings.tsx`, `supabase/functions/connect-driver/index.ts` |
| **A-05** | **Remove demo / debug routes from production.** Delete or wrap in `if (import.meta.env.DEV)` guards: `/demo/*`, `/admin/simulator`, `/app/diagnostics`, `/app/auth/login` (unreachable), `AuthLogin.tsx`, `AuthSignup.tsx`, `AppDashboard.tsx`, `AppDemo.tsx`, `LocationSimulator.tsx`, `TestSimulator.tsx`. | S (30 min) | `src/App.tsx`, `src/pages/app/*` |
| **A-06** | **Fix `CFBundleDisplayName`** to `FleetTrackMate Driver`. | S (5 min) | `ios/App/App/Info.plist:7-8` |
| **A-07** | **Rewrite Privacy policy & Terms** to truthful security claims; replace `gftm.com` and SF address with real entity details. Link Privacy/Terms from `DriverAppSettings.tsx`. | S (1 h) | `src/pages/Privacy.tsx`, `src/pages/Terms.tsx`, `src/pages/app/DriverAppSettings.tsx` |
| **A-08** | **Audit `NSPhotoLibraryAddUsageDescription` and `NSMicrophoneUsageDescription`.** Either ship the video-proof flow that uses them or remove from Info.plist and `scripts/ios-post-sync.sh`. | S (30 min) | `ios/App/App/Info.plist`, `scripts/ios-post-sync.sh`, code paths in `DriverAppCompleteTask.tsx` |
| **A-09** | **Locale-aware emergency number.** Replace `tel:112` with a country-aware lookup. | S (30 min) | `src/pages/app/DriverAppSOS.tsx:228, 378` |
| **A-10** | **Add "speed lock" for driving.** When `speed > 5 km/h`, hide non-critical buttons or show a "tap when stopped" overlay. | M (2 h) | `src/pages/app/DriverAppDashboard.tsx`, related task screens |
| **A-11** | **Cleanup**. Delete `ios/App/App/config 2.xml` … `config 5.xml`, duplicate logo JPGs, unreferenced demo pages. | S (15 min) | `ios/App/App/*` |
| **A-12** | **Replace pre-release deps**. `react-qr-scanner@1.0.0-alpha` → stable alt; `react-signature-canvas@1.1.0-alpha` → stable. | M (2 h, may need shim work) | `package.json`, `src/pages/driver/CompleteTask.tsx` |
| **A-13** | **App Store Connect tasks**: complete 2026 age-rating questionnaire; upload driver-flow screenshots only; write App Privacy Nutrition Label per `privacy-deep-dive.md` §2; add detailed App Review Notes (demo connection code, B2B context, no-IAP rationale, `processing` background-mode justification). | M (3 h) | App Store Connect (no repo changes) |

### Suggested order

1. **First half-day**: A-06, A-08, A-11, A-07 (cheap, low-risk source edits).
2. **Day 1 afternoon**: A-05, A-04 (route cleanup + deletion).
3. **Day 2**: A-01 (the big tree-shake) + verify with grep.
4. **Day 2 afternoon**: A-03, A-09, A-10.
5. **Day 3**: A-02 (Xcode 26 build), A-12.
6. **Day 3 afternoon**: A-13, archive, upload to TestFlight, internal smoke test.
7. **Day 4**: submit for review.

---

## Files in this audit

- `audit/REPORT.md` — this file
- `audit/guidelines-snapshot.md` — fetched guidelines summary + recent news
- `audit/guidelines-snapshot-raw.txt` — full guideline text (truncated by Apple's page; see snapshot note)
- `audit/app-inventory.md` — Step-2 codebase inventory
- `audit/section-by-section.md` — Step-3 verdict matrix
- `audit/privacy-deep-dive.md` — Step-4 privacy / nutrition-label / manifest deep dive
- `audit/pre-submission-checklist.md` — Step-5 checklist with statuses
