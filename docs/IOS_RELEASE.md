# iOS release status

Last updated: 2026-08-25 · iOS `2.2.2 (6)` · Android `2.2.2 (6)`

Supersedes the May 2026 audit in [`audit/`](../audit/) for anything that
disagrees. That audit described a **driver-only** app; the native bundle now
carries the manager portal too, which changes several of its conclusions.

---

## 1. Where iOS had fallen behind Android

The shared React bundle means iOS picks up feature work for free. What did
**not** keep up was the native shell, and every item below was silently broken
rather than loudly broken.

| Gap | Effect on iOS | Fixed by |
| --- | --- | --- |
| `@capacitor/local-notifications` was in `package.json` but never installed, so `pod install` never linked it and the generated `capacitor.config.json` never listed it | Every alert added for Android — new job, station still outstanding, SOS — was a no-op on iPhone. `schedule()` resolved successfully and nothing appeared | `npm install`, re-sync; plugin now in `Podfile.lock` and `packageClassList` |
| `alert.wav` / `chime.wav` sat in `ios/App/App/` but were never members of the App target | iOS resolves a notification sound by bundle filename. Not bundled → silent alert | Added to the Resources build phase in `project.pbxproj` |
| Nothing in the native app ever requested notification permission | iOS delivers **nothing** until authorised, and reports no error for the attempt | `notify()` now settles permission at the first alert worth showing; `DriverAppSettings` gained an Alerts row |
| `MARKETING_VERSION 1.0.1` / `CURRENT_PROJECT_VERSION 1` | Four feature releases behind Android's `2.2.2 (6)` | Bumped to match |
| `CFBundleDisplayName` = "FleetTrackMate Driver" | Wrong since the manager portal shipped; Android says "FleetTrackMate" | Renamed |

Android had the mirror-image bug in the same feature: `POST_NOTIFICATIONS` was
never declared, so Android 13+ dropped the same alerts. Now in the manifest and
in `scripts/android-post-sync.sh`.

**These three things must agree or notifications die quietly**, so
`scripts/ios-post-sync.sh` now fails loudly on each: the plugin in
`capacitor.config.json`, the pod in `Podfile.lock`, the sounds in the Xcode
Resources phase.

---

## 2. iOS authentication

### Fixed

**Google sign-in could never complete.** `Info.plist` registered the reversed
client ID scheme, but `AppDelegate` handed every incoming URL to Capacitor.
GoogleSignIn parks its continuation internally and only resumes when the URL
reaches `GIDSignIn.handle(url)` — so the account sheet closed onto a screen
that never changed, with no error to show. `AppDelegate.swift` now offers the
URL to Google first and falls through to Capacitor for `fleettrackmate://`.

**Password reset had nowhere to land.** The emailed link signed the manager in
and dropped them on the fleet map with the password they came to change still
unchanged, and no route to change it — the native bundle has no
`/auth/update-password`. Now: `completeOAuthCallback` reports the *kind* of
callback (checking `type=recovery` in both the query string and the fragment,
since PKCE and implicit put it in different places), and `AuthDeepLinks` routes
recovery links to a new `/app/admin/reset` screen.

**Cancelling the Apple sheet threw the user into Safari.** Any native failure
fell back to browser OAuth, cancellation included, so tapping "Cancel" launched
a second sign-in the user had just declined. Cancellation is now distinguished
from failure (`SignInCancelledError`) and ends the attempt silently.

### Sound as-is

- Sign in with Apple is present, listed first on iOS, and entitled in
  `App.entitlements` — required by guideline 4.8 because Google is offered.
- Apple needs no Services ID on iOS (the OS provides it), which is why
  `VITE_APPLE_SERVICE_ID` being empty is correct rather than an omission. It
  is also why the Apple button is iOS-only: Android and web would need that
  Services ID for the browser flow.
- `window.open(url, '_system')` does reach Safari on iOS — Capacitor's
  `WebViewDelegationHandler` routes `createWebViewWith` to
  `UIApplication.shared.open`. Google's OAuth policy forbids embedded webviews;
  this is not one.

### Needs your Supabase dashboard — sign-in will fail without it

1. **Auth → Providers → Google → Authorized Client IDs** must include
   `268918163192-obcad0161f7blcc97i15vmdb39t9ln5i.apps.googleusercontent.com`.
   The native path calls `signInWithIdToken`, and Supabase rejects a token
   whose audience it does not recognise.
2. **Auth → Providers → Apple → Authorized Client IDs** must include the bundle
   ID `app.fleettrackmate.driver`. For *native* Sign in with Apple the audience
   is the bundle ID, not a Services ID.
3. **Auth → URL Configuration → Redirect URLs** must include
   `fleettrackmate://auth/callback`. Without it the browser fallback, email
   confirmation, and password reset all break.

---

## 3. App Store guidelines

### Fixed in this pass

**3.1.3(f) — free companion to a paid web tool.** The guideline allows it only
while there is "no purchasing inside the app, **or calls to action for purchase
outside of the app**". Three screens named the website to a locked-out manager —
`SubscriptionGate`, `StationsUpsell`, `AdminAppAddDriver` — which is exactly the
second kind. They now state the limit and stop. `scripts/verify-native-bundle.sh`
treats `fleettrackmate.com` and `Plans are managed` as build-failing strings so
this cannot come back unnoticed.

**5.1.1(v) — account deletion.** The manager portal creates accounts, so
deletion must happen *in the app*; a support request does not satisfy it. The
page emailed `privacy@gftm.com` — a domain this project does not own — and
promised action "within 7 business days". It now calls a new
`supabase/functions/delete-account` that deletes the account for real, scoped
to the caller's own verified JWT. (The driver side already did this properly
via `connect-driver`.)

**5.1.1 — purpose strings.** Rewritten from generic ("track your position even
when the app is in the background") to specific: what is shared, with whom,
when it stops, and covering the features added since — station photos, vehicle
checks, expense receipts. Vague background-location strings are a common
rejection.

**Privacy manifest.** Added Email Address and Phone Number — both collected
since the manager portal shipped (sign-in, and the emergency contact a manager
stores for their drivers) and both absent from the declaration.

**Build hygiene.** `UIRequiredDeviceCapabilities` was `armv7`, an architecture
iOS dropped at 11 → `arm64`. Added `ITSAppUsesNonExemptEncryption = false` so
export compliance stops being asked on every upload.

### iPad: not a choice, as it turns out

`TARGETED_DEVICE_FAMILY` was briefly set to `1` (iPhone only), on the reasoning
that shipping an untested form factor invites a 2.4.1 / 4.0 rejection.

Apple rejected the upload outright — **ITMS-90101**: an update may not drop a
device family the previous version supported, and 1.0 / 1.0.1 both shipped as
`"1,2"`. Dropping iPad would require a new app record, not an update.

So it is back to `"1,2"` permanently, and `scripts/ios-post-sync.sh` now fails
the sync if it ever changes — the feedback loop at upload time is an archive, a
notarisation wait and a rejection, which is far too slow for a one-character
setting.

The underlying concern stands: App Review will test on iPad and there is no
iPad layout. That risk is now unavoidable, so it is worth spending the time on
a layout that at least does not embarrass itself at 1024pt wide.

### Still open — your call, not a code fix

**The 3.1.3(f) position is weaker than it was in May.** The argument then was
"free driver-side companion to a paid web tool". The native app now ships the
manager portal itself, with its core features gated behind a subscription sold
on the web. Nothing in the app sells or points at selling, so the letter of
3.1.3(f) is met — but a reviewer seeing a manager feature locked with an
off-app subscription behind it may push back. Two ways to stand it up:

- *Keep it as is* and make the App Review note explicit: FleetTrackMate is a
  B2B fleet tool bought by companies on the web; the app is a companion for
  staff who already have access; nothing is sold in the app.
- *Add StoreKit IAP* for the manager subscription. Substantial work, and it
  changes the pricing model, but it removes the argument entirely.

The store-reviewer full-access grant (`20260823090000_review_account_access.sql`)
helps considerably here — the reviewer sees a working app rather than a wall.

---

## 3a. Opening it in Xcode — `No such module 'Capacitor'`

Open **`ios/App/App.xcworkspace`**, never `ios/App/App.xcodeproj`.

The pods live in the workspace, not the project, so opening the bare project
fails on `AppDelegate.swift:2` with `No such module 'Capacitor'` — a line
nobody edited, which makes it look like a code error rather than a
wrong-file error. Reproduced and confirmed both ways:

```
xcodebuild -project   App.xcodeproj  …   ** BUILD FAILED **     unable to resolve module dependency: 'Capacitor'
xcodebuild -workspace App.xcworkspace …  ** BUILD SUCCEEDED **  (device, arm64, Release)
```

`npx cap open ios` always opens the right one. Worth knowing because every
`pod install` — which `npm run cap:sync:ios` runs for you — regenerates the
Pods project, so anyone with the bare project open sees this at the worst
moment.

## 4. Verified on this machine

```
npx tsc --noEmit                        clean
npm run build:native                    ✓ built
bash scripts/verify-native-bundle.sh    ✅ no admin / marketing / subscription strings
npm run cap:sync:ios                    ✓ all wiring checks pass
xcodebuild … -configuration Debug       ** BUILD SUCCEEDED **
xcodebuild … -configuration Release     ** BUILD SUCCEEDED **   (iOS 26.5 SDK, Xcode 17F113)
```

Inside the built `App.app`: `alert.wav`, `chime.wav`, `PrivacyInfo.xcprivacy`,
`CapacitorLocalNotifications.framework`, `GoogleSignIn.framework`;
`CFBundleDisplayName` = FleetTrackMate; version `2.2.2 (6)`; `UIDeviceFamily`
= `[1]`.

This settles item A-02 from the May audit — the app builds against the iOS 26
SDK.

## 5. Not verified — needs a device or your accounts

1. **Deploy the deletion function**: `npx supabase functions deploy delete-account`.
   Until then the Delete Account button returns an error. Test it on a
   throwaway manager account first — it is irreversible by design, and the
   table list in that function was derived from the migrations, so a table
   added later will need adding to it.
2. **Sign-in round trip on a real device** — Google and Apple, after the three
   Supabase settings in §2 are in place. The simulator cannot prove this.
3. **A notification actually arriving**: connect as a driver, sit inside a
   station radius for the dwell time, confirm the banner and the custom sound.
4. **App Store Connect**: age-rating questionnaire, privacy nutrition label
   (now including Email Address and Phone Number), iPhone-only screenshots,
   reviewer credentials, and the App Review note from §3.
