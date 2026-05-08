# Section-by-Section Verdicts

Legend: ✅ compliant · ⚠️ at risk · ❌ non-compliant · ➖ N/A

Quotes from the guidelines are kept under 15 words per Apple copyright notice.

---

## 1. Safety

### 1.1 Objectionable Content

| § | Verdict | Notes |
| --- | --- | --- |
| 1.1.1 Defamatory/discriminatory | ➖ N/A | No editorial / social content. |
| 1.1.2 Realistic violence | ➖ N/A | Not a game. |
| 1.1.3 Weapons / dangerous objects | ➖ N/A | Not present. |
| 1.1.4 Pornographic | ➖ N/A | Not present. |
| 1.1.5 Inflammatory religious | ➖ N/A | Not present. |
| 1.1.6 False info / fake location | ⚠️ At risk | `src/pages/app/LocationSimulator.tsx` and `TestSimulator.tsx` simulate fake GPS positions (admin debug tool, but bundled into the iOS JS). Apple has historically been skeptical of "fake location trackers." Recommend gating these screens behind a build-time flag stripped from production iOS, or removing them from the native bundle. |
| 1.1.7 Profiteering on tragedy | ➖ N/A | — |

### 1.2 User-Generated Content

⚠️ **At risk.** SOS messages, delivery photos, and signatures are user-submitted, but they are private (visible only to the dispatcher who issued the connection code), so the public-UGC pillars (filtering, reporting, blocking) do not strictly apply. However, App Review may ask for:
- A way to report inappropriate driver-submitted content (admin already has this server-side, but it's not in-app for drivers).
- Mention in App Review Notes that submissions are private/B2B and do not become public.

Recommend describing this clearly in the Review Notes; otherwise low risk.

### 1.3 Kids Category

➖ N/A — not submitting to Kids Category.

### 1.4 Physical Harm

| § | Verdict | Notes |
| --- | --- | --- |
| 1.4.1 Medical accuracy | ➖ N/A | No health diagnostic claims. |
| 1.4.2 Drug dosage | ➖ N/A | — |
| 1.4.3 Tobacco/drug encouragement | ➖ N/A | — |
| 1.4.4 DUI checkpoints | ➖ N/A | — |
| 1.4.5 Risky activity | ⚠️ At risk | The driver dashboard auto-tilts and rotates the map at speed > 5 km/h (`DriverAppDashboard.tsx:165-176`) and the SOS button is visible while driving. Apple specifically flags apps that "encourage device use that risks physical harm." Mitigation: add a passive driving-mode hint, ensure no input prompts appear while moving, and explicitly state in metadata "for use by drivers when stopped or by passengers." Adding a CarPlay-like passive UI or speed-locked controls is the safest path. |

### 1.5 Developer Information

⚠️ **At risk.** `src/pages/Privacy.tsx:128-130` and `src/pages/Terms.tsx:138-140` show contact addresses `privacy@gftm.com` / `legal@gftm.com` and **"San Francisco, CA, USA"**. The repo lives under `gobeth.ltd@gmail.com` and the bundle ID is `app.fleettrackmate.driver`. Verify the `gftm.com` domain is owned and the SF address is real, or replace with the actual entity (e.g., a Nigerian or UK Ltd company address — `gobeth.ltd@gmail.com` suggests a Ltd company). The App Store Support URL must point to a working contact channel.

### 1.6 Data Security

⚠️ **At risk.** Findings:
- The `react-qr-scanner` and `react-signature-canvas` packages are at **`1.0.0-alpha`** versions. Pre-release dependencies for shipping production apps that handle private location and identity data is a quality concern; reviewers don't audit deps but a CVE in either could become an embarrassing post-ship issue.
- Driver session is stored in `localStorage` (`DriverSessionContext.tsx:44-46`) including `adminCode`. WKWebView's `localStorage` is sandboxed but unencrypted at rest; a jailbroken-device extraction would expose connection codes. For a fleet-tracking app this is acceptable, but the privacy policy should disclose it.
- The Supabase **anon key** is hardcoded into the client (`src/integrations/supabase/client.ts`). This is normal for Supabase and is mitigated by RLS; ensure RLS policies are enabled on every table the anon role can touch.

### 1.7 Reporting Criminal Activity

⚠️ **At risk.** `DriverAppSOS.tsx` allows a "robbery" hazard category and posts to a private dispatcher. The button labelled "Call Emergency Services (112)" links via `tel:` to local emergency services (`tel:112` is EU/Nigeria emergency; **US is 911**). Apple notes that "Apps for reporting alleged criminal activity must involve local law enforcement" — here the SOS goes to the *dispatcher*, not to law enforcement directly. Mitigation: clarify in metadata that SOS is internal fleet emergency (not a public crime-reporting tool), and consider offering a country-aware emergency number (911 in US, 999 UK, 112 EU/NG) since `tel:112` will not connect in the US.

---

## 2. Performance

### 2.1 App Completeness

❌ **Non-compliant.** Multiple incomplete / placeholder surfaces:
- `src/pages/app/AuthLogin.tsx:21` shows `<CardDescription>Authentication coming in Phase 2</CardDescription>` with all inputs `disabled`. The page is bundled but not registered in `App.tsx` routes, so it should be unreachable. Still, "Phase 2" placeholder copy in any shipped JS will trigger 2.1(a) ("placeholder text … should be scrubbed"). Delete this file.
- `src/pages/BackgroundPathsDemo.tsx`, `HeroGeometricDemo.tsx`, `PulseBeamsDemo.tsx`, `Header3Demo.tsx`, `AppDemo.tsx`, `TestSimulator.tsx`, `LocationSimulator.tsx`, `LocationDiagnostics.tsx` are demo / debug pages registered in `App.tsx` (`/demo/*`, `/admin/simulator`, `/app/diagnostics`). Reviewers can sometimes reach these via copy-paste deep links. Strip from production routes before submitting.
- `src/components/PaymentWall.tsx:189` says "Your 7-Day Free Trial Has Ended". On TestFlight, an admin who logs in via `/auth/login` (still routable on native) and lacks a trial will see this — and can be redirected to a Stripe URL via `window.open` (3.1.1 violation, see Section 3).

### 2.2 Beta Testing

➖ N/A.

### 2.3 Accurate Metadata

| § | Verdict | Notes |
| --- | --- | --- |
| 2.3.1(a) Hidden features | ⚠️ At risk | The `/app/diagnostics`, `/admin/simulator` routes contain debug-only functionality. Strip or gate. |
| 2.3.2 IAP disclosure | ➖ N/A | No IAP. |
| 2.3.3 Screenshots | ⚠️ Pending | Not yet uploaded; ensure they show the **driver** experience (Map, SOS, Tasks) and not the admin dashboard, since the iOS app is the driver app. |
| 2.3.4 Previews | ➖ N/A | Likely none. |
| 2.3.5 Category | ⚠️ Pending | Recommend "Business" or "Productivity"; do **not** select "Navigation" (which has stricter expectations). |
| 2.3.6 Age rating | ⚠️ Pending | New 2026 age-rating questionnaire required; responses were due 2026-01-31. Re-complete in App Store Connect. Honest answers: location tracking, photo/video capture, no medical, no violent themes, no UGC visible to other users. |
| 2.3.7 Unique name / keywords | ⚠️ At risk | **App display name in `Info.plist` is `gobo-fleet-mate`** (line 7-8) — this should be `FleetTrackMate Driver`. Fix the `CFBundleDisplayName` value. |
| 2.3.8 Metadata 4+ | ✅ | No mature content. |
| 2.3.9 Material rights | ⚠️ | Logo files committed under `ios/App/App/Assets.xcassets/` ("FLEETTRACKMATE LOGO 1.jpg" etc.) — confirm you hold rights / are the trademark owner. |
| 2.3.10 No other-platform mentions | ❌ Non-compliant | `src/components/AppDownload.tsx` (rendered inside Landing) contains "Download FleetTrackMate Driver APK", "Android 8.0+ required", APK install instructions, and "Rocket Driver" branding. Although `App.tsx` redirects `/` to `/app/*` on native so Landing should not render at runtime, the entire bundle ships these assets. **Strongest advice: split native build to exclude Landing/Pricing/AppDownload entirely**, e.g., via a Vite mode flag that tree-shakes them. |
| 2.3.11 Pre-order | ➖ N/A | — |
| 2.3.12 What's New text | ⚠️ Pending | Write in App Store Connect. |
| 2.3.13 In-app events | ➖ N/A | — |

### 2.4 Hardware Compatibility

| § | Verdict | Notes |
| --- | --- | --- |
| 2.4.1 iPhone runs on iPad | ⚠️ | `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone+iPad), but the UI is hard-coded mobile-first (no iPad-aware layouts). Either drop iPad ("1") or test thoroughly on iPad. |
| 2.4.2 Battery / heat | ⚠️ At risk | Continuous high-frequency GPS + map rendering will drain battery. Transistorsoft's motion-aware throttling helps. The `On Duty` toggle + "Off Duty" path exists. Acceptable but expect questions. |
| 2.4.3 Apple TV | ➖ N/A | — |
| 2.4.4 Don't suggest restart | ✅ | — |
| 2.4.5 Mac App Store | ➖ N/A | — |

### 2.5 Software Requirements

| § | Verdict | Notes |
| --- | --- | --- |
| 2.5.1 Public APIs / current SDK | ❌ **Non-compliant** | From **2026-04-28** (5 days ago at audit time), uploads must build with iOS 26 SDK. Verify your Xcode is 26.x and Base SDK is iOS 26. Deployment target 14.0 is OK. |
| 2.5.2 Self-contained | ✅ | No remote code download. `bundledWebRuntime: false` and no `server.url` in production. |
| 2.5.3 No malware | ✅ | — |
| 2.5.4 Background modes for stated purpose | ⚠️ At risk | `UIBackgroundModes` declares `location`, `fetch`, `processing`. `processing` is rare and triggers extra reviewer scrutiny. Justification: Transistorsoft uses BGTaskScheduler `processing` to reconcile location queues. Document this in Review Notes. Also, location-tracking apps must show a **periodic prompt** about continued background use; iOS does this automatically for "Always" authorization — verify the app handles `kCLAuthorizationStatusAuthorizedAlways` correctly. |
| 2.5.5 IPv6 | ✅ Likely | All endpoints (Supabase, Google Maps) support IPv6. |
| 2.5.6 WebKit | ✅ | Capacitor's WKWebView. |
| 2.5.7 Omitted | ➖ | — |
| 2.5.8 No alternate desktops | ✅ | — |
| 2.5.9 Standard switches | ✅ | — |
| 2.5.10 Omitted | ➖ | — |
| 2.5.11 SiriKit | ➖ N/A | — |
| 2.5.12 CallKit / SMS Fraud | ➖ N/A | — |
| 2.5.13 Facial recognition | ➖ N/A | No facial auth. |
| 2.5.14 Recording user activity | ⚠️ At risk | Continuous background location is "logging user activity" — guideline says apps must "request explicit user consent and provide a clear visual and/or audible indication." iOS's blue location pill satisfies the visual requirement. Verify the app does **not** suppress the iOS background-location indicator (Transistorsoft does not). The driver also explicitly toggles On/Off Duty (verified `DriverAppDashboard.tsx:76-83`). |
| 2.5.15 Files app integration | ➖ N/A | — |
| 2.5.16 Widgets / extensions | ➖ N/A | — |
| 2.5.17 Matter | ➖ N/A | — |
| 2.5.18 Display advertising | ➖ N/A | No ads. |

---

## 3. Business

### 3.1 Payments

#### 3.1.1 In-App Purchase

❌ **Non-compliant if reachable in the iOS bundle.** The codebase contains:
- `src/components/PaymentWall.tsx:121` — `window.open(data.url, "_blank")` opening Stripe checkout URL.
- `src/components/PaymentModal.tsx:107` — same pattern, Paystack or Stripe.
- `src/components/Pricing.tsx` — pricing CTA "Subscribe — ₦5,799/month" linking through to Stripe/Paystack.

Subscriptions sell "unlock" of admin features (geofencing, analytics, push notifications, etc.), which are digital services consumed inside the same React app — the textbook 3.1.1 case requiring **StoreKit IAP**.

Two potential defenses:
1. **3.1.3(c) Enterprise Services**: arguable, since fleet companies subscribe on behalf of their drivers/employees. But Apple often pushes back: "Consumer, single user, or family sales must use in-app purchase." A solo trucker using the app for their own vehicles is consumer.
2. **3.1.3(f) Free Stand-alone Apps companion to a paid web tool**: this is the best fit. The driver iOS app is free, doesn't sell anything, and the admin/owner web dashboard is the paid web tool. **Critical condition: "no purchasing inside the app, or calls to action for purchase outside of the app."**

To rely on 3.1.3(f), the iOS bundle **must not contain** any path that:
- Renders pricing / Subscribe / Pay buttons.
- Opens Stripe/Paystack checkout URLs.
- Mentions "$1.99 / $3.99 / Trial Expired / Upgrade Now".

The current bundle violates all three because `PaymentWall`, `PaymentModal`, `Pricing`, and the `AppLayout` "Upgrade Now" banner (`src/components/layout/AppLayout.tsx:78-82`) are all bundled — and `/dashboard` and `/auth/login` are routed even on native.

**Required action**: tree-shake or feature-flag these out of the iOS build. Confirm the iOS bundle's JS strings don't contain any Stripe/Paystack subscription copy.

#### 3.1.1(a) Link to Other Purchase Methods

➖ N/A if 3.1.3(f) defense is taken. If we accept 3.1.1 applies (i.e., subscriptions stay reachable), then external links require the StoreKit External Purchase Link Entitlement (not US storefront). Don't go down this road; just exclude payment screens from native.

#### 3.1.2 Subscriptions

➖ N/A (no IAP). If IAP is added later, must include: ongoing value, ≥7-day period, cross-device, restore mechanism, clear price/duration disclosure pre-purchase, terms/privacy links. The current Stripe subscription IS auto-renewing and is sold via the web dashboard; that's fine — Apple doesn't regulate the web tool, only the iOS app's in-app purchasing.

#### 3.1.3 Other Purchase Methods

✅ if iOS app is locked down to driver-only and is free. The driver app fits 3.1.3(f) "Free Stand-alone Apps acting as a stand-alone companion to a paid web based tool." Document this in Review Notes:

> "FleetTrackMate Driver is the free driver-side companion to the FleetTrackMate fleet management web platform (https://fleettrackmate.com). Drivers connect via a code from their fleet administrator and never make purchases. Subscriptions are purchased only by fleet owners on the web dashboard. There are no purchase calls-to-action in this app."

#### 3.1.4 Hardware-Specific Content

➖ N/A.

#### 3.1.5 Cryptocurrencies

➖ N/A.

### 3.2 Other Business Model Issues

| § | Verdict | Notes |
| --- | --- | --- |
| 3.2.1(i)–(ii) Display own/3rd-party apps | ➖ N/A | — |
| 3.2.1(viii) Financial trading | ➖ N/A | — |
| 3.2.2(v) Geo-restrict | ⚠️ At risk | Paystack is Nigerian-only, Stripe is global. The web tool serves NG + intl. Make sure App Store availability is set to all relevant storefronts and the in-app text doesn't artificially restrict by country. |

---

## 4. Design

### 4.1 Copycats

✅ — distinctive name and branding.

### 4.2 Minimum Functionality

✅ — substantial functionality (real-time GPS, tasks, SOS, analytics integration).

### 4.3 Spam

✅ — single bundle ID.

### 4.4 Extensions

➖ N/A.

### 4.5 Apple Sites and Services

| § | Verdict | Notes |
| --- | --- | --- |
| 4.5.1 Don't scrape Apple | ✅ | — |
| 4.5.2 Apple Music | ➖ N/A | — |
| 4.5.3 Don't spam Game Center / Push | ➖ N/A | No push yet. |
| 4.5.4 Push Notifications | ✅ if no push | App declares no `aps-environment` entitlement and no push registration code; safe. README mentions push notifications as "Coming Soon"; add later carefully. |
| 4.5.5 Game Center | ➖ N/A | — |
| 4.5.6 Apple emoji | ✅ | — |

### 4.6

Intentionally omitted.

### 4.7 Mini apps / chatbots / streaming games / emulators

➖ N/A — no mini-apps, no chatbot, no streaming games, no plugins.

### 4.8 Login Services

✅ **Compliant.** The driver iOS app uses a **company-specific code-based session** (admin issues a code; driver enters it). 4.8 says: "Another login service is not required if … your app uses your company's own account setup." The driver session is exactly that. **No third-party SSO is offered**, so Sign in with Apple is not required.

> Caveat: if the bundle exposes `/auth/login` (the Supabase email/password screen) on native, and a future change adds Google or Facebook sign-in to that screen, then Sign in with Apple becomes mandatory. As of this audit, only email/password is wired.

### 4.9 Apple Pay

➖ N/A — not used.

### 4.10 Monetizing Built-In Capabilities

✅ — not selling access to push/camera/etc.

---

## 5. Legal

### 5.1 Privacy

#### 5.1.1 Data Collection and Storage

| § | Verdict | Notes |
| --- | --- | --- |
| (i) Privacy Policy | ⚠️ At risk | `Privacy.tsx` exists at `/privacy` but is **not linked from the driver app's UI**. Drivers using the iOS app may never see it. Apple requires the policy URL in App Store Connect AND "within the app in an easily accessible manner." Add a footer link in `DriverAppLayout` or in `DriverAppSettings`. The policy text also makes claims like **"End-to-end encryption", "SOC 2 compliant infrastructure", "Regular penetration testing"** — verify these are true; if not, remove (false claims about security can be a 1.6 issue and a consumer protection issue). |
| (ii) Permission / consent | ✅ Likely | Permissions are runtime-prompted via Capacitor / iOS standard prompts; LocationBlocker component in `DriverAppDashboard.tsx:289-291` blocks usage until granted. |
| (iii) Data minimization | ⚠️ | Audit whether you actually need both `NSLocationWhenInUse` and `NSLocationAlwaysAndWhenInUse`. The "Always" string is the more sensitive request — make sure the runtime consent flow first asks WhenInUse, then escalates to Always with context (Apple's preferred pattern). |
| (iv) Access | ✅ | The app correctly handles permission denial (LocationBlocker). |
| (v) Account deletion | ⚠️ At risk | `src/pages/DeleteAccount.tsx` is at `/delete-account`. **It only works for Supabase-authenticated users** (`if (!user) return null`). The driver iOS app uses code-based sessions, not Supabase auth, so a driver tapping "Delete Account" in the iOS app would see "Not logged in?" copy with a fallback `mailto:`. Apple's account deletion guidance: in-app deletion must be "as easy as account creation." For drivers, "creation" is just entering a code — so "deletion" should be one-tap to disconnect + clear local data + request server deletion via the `connect-driver` edge function. Add a "Disconnect & Delete My Data" button in `DriverAppSettings.tsx`. |
| (vi) Surreptitious data | ✅ | Behavior is transparent. |
| (vii) SafariViewController tracking | ➖ N/A | — |
| (viii) Public-database scraping | ✅ | — |
| (ix) Highly regulated fields | ⚠️ | Fleet tracking is not "highly regulated" per se, but consumer-facing tracking apps draw scrutiny. Submitting under a registered Ltd entity (as `gobeth.ltd@gmail.com` suggests) is the right move. |
| (x) Optional contact info | ✅ | Driver only enters their name. |

#### 5.1.2 Data Use and Sharing

| § | Verdict | Notes |
| --- | --- | --- |
| (i) Permission / ATT | ✅ | No tracking SDKs found, so ATT is not required. **Do not** add Firebase, Facebook SDK, Adjust, AppsFlyer, etc., without then implementing the ATT prompt. |
| (ii) Repurposing | ⚠️ | The driver's location is shared with the dispatcher only. This must be made explicit in the privacy policy and the runtime consent context ("share your position with your fleet manager" — ✅ already in the `NSLocationWhenInUse` reason). |
| (iii)–(iv) Profile-building / Contacts | ✅ | Not applicable. |
| (v) Photos messaging | ✅ | — |
| (vi) HomeKit / HealthKit / etc. for marketing | ✅ | None used. |
| (vii) Apple Pay sharing | ➖ N/A | — |

#### 5.1.3 Health and Health Research

➖ N/A.

#### 5.1.4 Kids

➖ N/A — driver app is for working drivers, not minors. Make sure App Store age rating is 17+ or 12+ depending on questionnaire (the new 2026 system).

#### 5.1.5 Location Services

⚠️ **At risk — borderline.** The guideline says: "Location-based APIs **shouldn't be used to provide emergency services** or autonomous control over vehicles…" The SOS feature uses location to dispatch a fleet-internal alert, NOT to summon public emergency services. The "Call 112" button uses `tel:` (which is just a phone-call shortcut, not a Location API). Provided you don't market this as an "emergency service" but as a "fleet emergency notification," 5.1.5 is satisfied. **Do not advertise the SOS as a substitute for 911/112.**

### 5.2 Intellectual Property

| § | Verdict | Notes |
| --- | --- | --- |
| 5.2.1 General | ⚠️ | Confirm trademark / company ownership of the `FleetTrackMate` name. |
| 5.2.2 Third-party services | ✅ | Stripe / Paystack / Google Maps / Supabase are all used per their ToS. |
| 5.2.3 Audio/video downloading | ➖ N/A | — |
| 5.2.4 Apple endorsements | ✅ | — |
| 5.2.5 Apple products lookalikes | ✅ | — |

### 5.3 Gaming, Gambling, Lotteries

➖ N/A.

### 5.4 VPN Apps

➖ N/A.

### 5.5 Mobile Device Management

➖ N/A — though the always-on tracking can superficially resemble MDM. Be clear in metadata that this is opt-in fleet tracking, not device management.

### 5.6 Developer Code of Conduct

(Not in fetched content.) Standard expectations apply.

---

## Summary of verdicts

| Section | Verdict |
| --- | --- |
| 1.1 | ✅ / ⚠️ on 1.1.6 |
| 1.2 | ⚠️ |
| 1.3 | ➖ |
| 1.4.5 | ⚠️ |
| 1.5 | ⚠️ |
| 1.6 | ⚠️ |
| 1.7 | ⚠️ |
| 2.1 | ❌ |
| 2.3.7 | ⚠️ |
| 2.3.10 | ❌ |
| 2.5.1 | ❌ |
| 2.5.4 | ⚠️ |
| 3.1.1 | ❌ if PaymentWall reachable; ✅ via 3.1.3(f) if removed |
| 4.8 | ✅ |
| 5.1.1(i) | ⚠️ |
| 5.1.1(v) | ⚠️ |
| All others | ✅ or ➖ |
