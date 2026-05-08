# App Inventory

## 1. Project structure

| Item | Value | Source |
| --- | --- | --- |
| App display name | `gobo-fleet-mate` (Info.plist line 8) — **mismatch** with `appName: "FleetTrackMate Driver"` in capacitor.config | `ios/App/App/Info.plist:7-8`, `capacitor.config.ts:19` |
| Bundle identifier | `app.fleettrackmate.driver` | `ios/App/App.xcodeproj/project.pbxproj` |
| Marketing version | 1.0 | pbxproj |
| Build number | 1 | pbxproj |
| iOS deployment target | **14.0** | `Podfile:3`, pbxproj |
| Targeted device family | iPhone + iPad (`"1,2"`) | pbxproj |
| Swift version | 5.0 | pbxproj |
| Development team | 442N7GQZ5N | pbxproj |
| Architecture | Capacitor 7.4 wrapper around a Vite + React + TypeScript SPA | `package.json`, `capacitor.config.ts` |

**Build SDK requirement (Apple)**: From **2026-04-28**, all iOS app uploads must be built with the iOS 26 SDK or later. The deployment target of 14.0 is unaffected, but the host Xcode/SDK must be 26.x. Verify in Xcode → Build Settings → Base SDK.

## 2. App purpose

FleetTrackMate Driver is the **driver-side mobile companion** to a fleet-tracking SaaS. The native app runs a code-based driver session (no email/password): an admin generates a connection code, the driver enters it plus their name, and the app then streams live GPS location, accepts delivery tasks, and provides an SOS panic button with photo evidence. The **admin/owner experience is web-only** (Supabase-authenticated dashboard with Stripe/Paystack subscriptions for fleet managers); on native, `App.tsx:117-124` redirects `/` to the driver `/app/*` flow.

## 3. Third-party dependencies

### Capacitor plugins (native-bound) — `Podfile`, `capacitor.config.json`

| Plugin | Purpose | Data |
| --- | --- | --- |
| `@capacitor/core` v7.4.5 | Bridge | None directly |
| `@capacitor/camera` v7.0.3 | Photo capture | Camera, Photo Library |
| `@capacitor/geolocation` v7.1.5 | Coarse foreground GPS | Location |
| `@capacitor/app`, `haptics`, `keyboard`, `status-bar` | Native UI shims | None |
| `@transistorsoft/capacitor-background-geolocation` v8.0.1 | Continuous background GPS, motion-aware throttling | Location, motion |
| `@transistorsoft/capacitor-background-fetch` v8.0.0 | iOS BGTaskScheduler trigger for `com.transistorsoft.fetch` and `com.transistorsoft.customtask` | None directly |
| `@capawesome-team/capacitor-android-foreground-service` v8.1.0 | Android-only persistent foreground service | None on iOS |

### Web/runtime libraries — `package.json`

- **Backend / data**: `@supabase/supabase-js` v2.78 (auth, database, edge functions, storage, realtime). Hardcoded URL `https://invbnyxieoyohahqhbir.supabase.co` in `src/integrations/supabase/client.ts:5` plus a publishable anon key.
- **Maps**: `@react-google-maps/api` v2.20 (Google Maps via `VITE_GOOGLE_MAPS_API_KEY`); README mentions Mapbox but I found only Google Maps in active source code (Mapbox token referenced in README is stale).
- **UI**: shadcn/Radix, Tailwind, framer-motion, lucide-react, Sonner toasts.
- **State / forms**: React Query, react-hook-form, zod.
- **Driver UX**: `react-qr-scanner` v1.0.0-alpha (QR pickup verification), `react-signature-canvas` v1.1.0-alpha (delivery proof).
- **Dev-only tagger**: `lovable-tagger` v1.1.9 (build-time JSX tagger; verified absent from `dist/index.html` ⇒ not shipped to native).

### No analytics / tracking SDKs detected

`grep` for Firebase, Sentry, Crashlytics, PostHog, Mixpanel, Amplitude, Segment, AppsFlyer, Adjust, Google Analytics, Facebook SDK, Datadog ⇒ **zero matches** in `src/`. README explicitly notes "Firebase removed to avoid conflicts."

### No AI/LLM integrations detected

`grep` for OpenAI, Anthropic, Gemini, Cohere, HuggingFace, generative-ai, gpt-, chat.completions ⇒ zero matches in `src/` and `supabase/functions/`.

## 4. Permissions requested (`NSUsageDescription` in `ios/App/App/Info.plist`)

| Key | Reason string | Used by |
| --- | --- | --- |
| `NSCameraUsageDescription` | "FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof." | DriverAppSOS, DriverAppCompleteTask |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | "FleetTrackMate needs continuous location access to track your position even when the app is in the background." | trackingService (Transistorsoft) |
| `NSLocationWhenInUseUsageDescription` | "FleetTrackMate needs your location to share your position with your fleet manager." | foreground geolocation |
| `NSMicrophoneUsageDescription` | "FleetTrackMate needs microphone access when recording delivery proof videos." | CompleteTask (video proof) |
| `NSMotionUsageDescription` | "FleetTrackMate uses motion data to optimize battery usage during location tracking." | Transistorsoft motion-aware throttling |
| `NSPhotoLibraryAddUsageDescription` | "FleetTrackMate needs permission to save captured media to your library." | (likely not invoked in driver flow — see risks) |
| `NSPhotoLibraryUsageDescription` | "FleetTrackMate needs photo library access to select photos and videos for emergency reports and delivery proof." | DriverAppSOS gallery select, DriverAppCompleteTask |

`UIBackgroundModes`: `location`, `fetch`, `processing`. `BGTaskSchedulerPermittedIdentifiers`: `com.transistorsoft.fetch`, `com.transistorsoft.customtask` (added today).

## 5. Entitlements

**No `.entitlements` file in `ios/App/App/`.** The bundle ships without one, which means: no Push Notifications (`aps-environment`), no Sign in with Apple, no App Groups, no Associated Domains, no Keychain Sharing. Background mode capability is declared via `UIBackgroundModes` in Info.plist only (Apple allows this, but Xcode's "Capabilities" pane normally also writes an entitlement when toggled).

## 6. Capabilities used

- **Background modes**: location updates, background fetch, BGTaskScheduler processing tasks (Transistorsoft).
- **Camera + Photo Library**: native camera capture and gallery selection via `src/utils/nativeCamera.ts` wrapping `@capacitor/camera`.
- **Location services** (foreground + background): primary feature.
- **Motion**: Core Motion via Transistorsoft to optimize update cadence.
- **Microphone**: declared for video delivery proof; only conditionally invoked.
- **No HealthKit, HomeKit, CallKit, ClassKit, ARKit, CloudKit, App Tracking Transparency, Sign in with Apple, StoreKit, WeatherKit, Matter, Push Notifications, WidgetKit, App Clips.**

## 7. Network endpoints (hardcoded or env-injected)

- `https://invbnyxieoyohahqhbir.supabase.co` (Supabase project URL — `src/integrations/supabase/client.ts:5`).
- `https://fleettrackmate.com/...` (canonical / OG URLs in `index.html`; not API).
- `https://fonts.googleapis.com`, `https://fonts.gstatic.com` (Google Fonts in `index.html`).
- Google Maps JS API endpoints via `@react-google-maps/api` (URL constructed from `VITE_GOOGLE_MAPS_API_KEY`).
- Stripe + Paystack: opened via `window.open(data.url, "_blank")` in `PaymentWall.tsx:121` and `PaymentModal.tsx:107`. The actual checkout URLs are returned by Supabase Edge functions `create-checkout` (Stripe) and `create-paystack-checkout` (Paystack). **These code paths are bundled into the iOS app even though they are not part of the driver UI.**

## 8. User-generated content

- **SOS report**: free-text message + optional photo evidence + hazard category, sent via the `sos-create` edge function. Visible only to the fleet admin who issued the driver's connection code. Not public, not multi-user-visible. Not "social".
- **Delivery proof**: photo, video, signature attached to a completed task. Same admin-private scope.
- **No public posting, comments, profiles, or open chat surfaces.**

Conclusion: the app is **not** UGC under guideline 1.2's social/posting interpretation, but reviewers may still ask about moderation paths (especially photo content). Plan to disclose in App Review Notes that submissions are private and only visible to the dispatcher account.

## 9. AI/ML features

None detected.

## 10. Monetization

| Surface | Detail | Reachability on iOS |
| --- | --- | --- |
| `PaymentWall.tsx`, `PaymentModal.tsx`, `Pricing.tsx` | $1.99 Basic / $3.99 Pro monthly subscriptions sold via **Stripe** or **Paystack**, opened via `window.open` to an external checkout URL returned by Supabase Edge functions. | **Bundled but not linked from the `/app/*` driver routes.** The non-driver routes (`/dashboard`, `/auth/login`, etc.) ARE registered in `App.tsx` even on native, so a deep link or browser back-button could surface them. |
| 7-day free trial | Mentioned in `Pricing.tsx`, `PaymentWall.tsx` ("Trial Expired" copy) and `PaymentModal.tsx` (`subscription.trialExpired`). | Same as above. |
| Apple StoreKit / IAP | **None.** No `StoreKit`, `Purchases.framework`, RevenueCat, or App Store Connect IAP product IDs found. | — |

The README and `Pricing.tsx:80` repeatedly state "**driver app is always free** — payment only affects admin dashboard." This is the cornerstone of the App Store positioning argument (3.1.3(f) free stand-alone app companion), but the *bundle still ships* the payment screens in compiled JS. See REPORT for risk handling.

## 11. Backend (Supabase)

`supabase/functions/`:
- `bulk-email`, `send-email`, `geofence-email`, `trial-reminder`, `notify-inactivity` — admin-side email comms.
- `create-checkout`, `create-paystack-checkout`, `verify-paystack-payment`, `manage-subscription`, `check-subscription`, `paystack-webhook`, `stripe-webhook` — admin subscription billing.
- `connect-driver` — primary driver-side API (auth-less; takes admin code).
- `pod-otp` — proof-of-delivery one-time-password.
- `sos-create`, `sos-dispatch` — SOS lifecycle.
- `temp-track` — temporary share-link tracking (`/share/:token` route, public).

## 12. Misc / repository hygiene observations (not Apple-facing but flagged to user)

- Multiple stale duplicates clutter `ios/App/App/`: `config 2.xml`, `config 3.xml`, `config 4.xml`, `config 5.xml`. These are .gitignore candidates / cleanup targets.
- A 600-permission file named `fleettrackmate` sits at the project root. Not read for this audit (likely a credential or SSH key); flagged to user to confirm it's gitignored.
- `bun.lockb` (binary) and `bun.lock` (text) both committed.
- `.lovable/` directory exists at root; not bundled into native builds.
- `dist/index.html` does NOT contain any `lovable` / `gpteng` script tags (good — the dev-only tagger is correctly stripped from production builds).

---

Inventory complete. See `REPORT.md` for verdicts.
