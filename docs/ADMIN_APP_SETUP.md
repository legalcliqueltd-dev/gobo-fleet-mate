# Manager portal in the mobile app — setup guide

The Android/iOS app now ships **both** faces of FleetTrackMate behind a
one-time mode picker:

| Mode | Route | Sign-in |
| --- | --- | --- |
| Driver | `/app/driver` | Connection code + name (unchanged) |
| Manager | `/app/admin` | Email/password, Google, or Apple |

The choice is remembered in `localStorage` (`ftm_app_role`), so the picker
appears only on first launch. Either Settings screen has **Switch mode** to
come back to it.

Manager accounts are the *same* Supabase identities as the website — someone
who signed up on fleettrackmate.com can sign straight into the app.

---

## What still needs YOUR credentials

Email/password sign-in works today with no setup. Google and Apple need
developer accounts, which only you can create. Until they are configured the
buttons fall back to a browser OAuth flow, and that too needs the Supabase
providers enabled.

### 1. Supabase — enable the providers (required for both paths)

Dashboard → **Authentication → Providers** on project `invbnyxieoyohahqhbir`:

- Enable **Google**, paste the Web client ID + secret from step 2.
- Enable **Apple**, paste the Services ID + generated secret from step 3.

Then Dashboard → **Authentication → URL Configuration → Redirect URLs**, add:

```
fleettrackmate://auth/callback
https://fleettrackmate.com/app/admin
```

Without the first entry the browser fallback cannot return into the app.

### 2. Google Cloud Console → APIs & Services → Credentials

Create **three** OAuth client IDs under the same project:

| Type | Used for | Notes |
| --- | --- | --- |
| Web application | Supabase + Android token verification | Authorised redirect URI: `https://invbnyxieoyohahqhbir.supabase.co/auth/v1/callback` |
| Android | The native account sheet | Package `app.fleettrackmate.driver` + SHA-1 of your **release** keystore *and* your debug keystore |
| iOS | The native account sheet | Bundle ID `app.fleettrackmate.driver` |

Get the debug SHA-1 with:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

For the release SHA-1, run the same command against the keystore you already
use for Play uploads.

### 3. Apple Developer (needed for iOS — App Store guideline 4.8)

Because the app offers Google sign-in, Apple **requires** Sign in with Apple on
iOS. In the Apple Developer portal:

1. Enable the **Sign In with Apple** capability on App ID `app.fleettrackmate.driver`.
2. Create a **Services ID** (e.g. `com.fleettrackmate.web`) — this is the
   "client ID" for the Android/web flow.
3. Configure its return URL to
   `https://invbnyxieoyohahqhbir.supabase.co/auth/v1/callback`.
4. Create a **Key** for Sign in with Apple, download the `.p8`, and use it to
   generate the client secret Supabase asks for.
5. In Xcode, add the **Sign in with Apple** capability to the App target.

### 4. Put the IDs into the build

Create/extend `.env` at the repo root (these are build-time public values, and
`VITE_`-prefixed vars are embedded in the bundle — never put secrets here):

```bash
VITE_GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
VITE_GOOGLE_IOS_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
VITE_APPLE_SERVICE_ID=com.fleettrackmate.web
VITE_APPLE_REDIRECT_URL=https://invbnyxieoyohahqhbir.supabase.co/auth/v1/callback
```

For iOS, also add the **reversed** Google iOS client ID as a second URL scheme
in `ios/App/App/Info.plist` (`com.googleusercontent.apps.xxxxxxxx`).

Rebuild after changing `.env` — Vite inlines these at build time.

---

## How sign-in resolves at runtime

`src/services/adminAuth.ts` picks the best available path, in order:

1. **Native sheet** — if the matching client ID is configured, the plugin shows
   the OS account picker and the resulting identity token is exchanged with
   Supabase via `signInWithIdToken`. No browser, no redirect.
2. **Browser OAuth** — otherwise the provider opens in the *system* browser
   (never an in-app webview, which Google's OAuth policy rejects) and returns
   through `fleettrackmate://auth/callback`, handled by the `appUrlOpen`
   listener registered in `NativeApp.tsx`.

So the app always has a working sign-in, and it silently upgrades to the nicer
native experience once you finish the credential setup.

---

## Google Maps key — must accept the app's WebView origin

The driver dashboard now renders **Google Maps** (Uber/Bolt-style nav view)
instead of Leaflet, so `VITE_GOOGLE_MAPS_API_KEY` is loaded inside the app, not
just on the website. A Capacitor WebView is not `fleettrackmate.com`, so if the
key is restricted by HTTP referrer it must also allow the app's origins:

```
https://localhost/*        ← Android (Capacitor androidScheme: https)
capacitor://localhost/*    ← iOS
http://localhost:*/*       ← local `vite preview` testing
```

Google Cloud Console → **Credentials → Maps Platform API Key → Website
restrictions**. Symptom if this is missed: grey tiles plus a
`RefererNotAllowedMapError` in the console, only on device.

Also note the billing shape: the Maps **JavaScript API** bills per map load
(~$7 per 1,000 after the free monthly credit), and every driver app session
loads a map. That is the trade-off for leaving keyless Leaflet behind; watch
the quota once several drivers are live, and set a budget alert.

## Deliberate constraints — do not "fix" these by accident

- **No purchase surfaces in the native bundle.** The manager screens must never
  import `LockedFeature` (it pulls in `PaymentWall`), `PaymentModal`, `Pricing`,
  or the Stripe/Paystack checkout paths. `scripts/verify-native-bundle.sh` fails
  the build if their strings appear. This is the basis for App Store guideline
  3.1.3(f) — a free companion to a paid web tool. Billing stays on the website;
  the app shows plan status as read-only text only.
- **Account deletion is routed in-app** (`/delete-account`, linked from manager
  Settings) because the app can now create accounts — App Store guideline
  5.1.1(v) requires it.
- **`compileSdk` is 36, `targetSdk` stays 35.** The bump is only to satisfy
  `androidx.browser:1.9.0` from the social-login plugin; raising `targetSdk`
  would change runtime behaviour and is a separate decision.
- **Facebook and Twitter providers are disabled** in `capacitor.config.driver.ts`
  so their SDKs are never bundled — smaller APK, and no third-party data
  collection to declare on Play or in Apple's privacy manifest.
- **Never run bare `npx cap sync android`** — always follow with
  `bash scripts/android-post-sync.sh` (or use `npm run cap:sync:android`).

---

## iOS parity status (2026-08-13)

The iOS project is synced with the current bundle and plugin set:

- `ios/App/App/public/` now carries the same web build as Android (it had never
  been synced before).
- `ios/App/Podfile` gained `CapacitorApp` and `CapgoCapacitorSocialLogin`, so
  the deep-link and social-sign-in plugins are wired for iOS too.
- `Info.plist` keeps the `fleettrackmate` URL scheme for the OAuth callback.

Two steps can only run on macOS and are therefore still outstanding:

```bash
cd ios/App && pod install     # CocoaPods is not installed on this machine
bash scripts/ios-post-sync.sh # needs PlistBuddy (macOS only)
```

Until `pod install` runs, an Xcode build will not see the two new plugins.

## iOS build

The iOS platform exists but has not been built in this environment (it needs
macOS + Xcode). After the credentials are in place:

```bash
npm run cap:build:ios
npx cap open ios
```

Then in Xcode add the **Sign in with Apple** capability, confirm the URL scheme
from `Info.plist`, and archive. The UI is the same web bundle on both
platforms, so Android and iOS render identically apart from the system fonts
and safe-area insets, which are already handled.
