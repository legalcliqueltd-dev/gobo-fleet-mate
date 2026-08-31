# Handoff prompt

Paste the block below into a fresh Claude Code session in this repo.

---

```
FleetTrackMate — Capacitor 7 + React + Supabase, iOS/Android/web from one bundle.
Build 2.2.2 (6) is uploaded to App Store Connect and NOT yet submitted for review.
main is at the merge of the ios-release-and-platform-console branch; tree is clean.

Read these first — they carry the reasoning, not just the what:
  docs/IOS_RELEASE.md   what was broken on iOS and why, plus open decisions
  docs/AUTH_EMAILS.md   auth email branding + custom SMTP
  docs/IAP_PLAN.md      in-app purchase plan for 2.3.0
  audit/                May 2026 App Store audit; superseded by IOS_RELEASE.md where they disagree

OUTSTANDING, roughly in priority order:

1. Deploy sos-dispatch. The fix is committed and merged but NOT deployed — production
   still runs the old code. It previously resolved an SOS recipient by selecting every
   user with role='admin' and emailing profiles[0], which could send one fleet's
   emergency to an unrelated customer. Needs a fresh Supabase access token (see below).
     npx supabase functions deploy sos-dispatch --project-ref invbnyxieoyohahqhbir

2. Bump MinimumOSVersion 14.0 -> 15.0. Currently an upload warning; becomes a hard
   error Spring 2027. Costs no device coverage — iOS 15 supports the same hardware as
   iOS 14 (iPhone 6s and later). Touches IPHONEOS_DEPLOYMENT_TARGET in
   ios/App/App.xcodeproj/project.pbxproj, the platform line in ios/App/Podfile, then
   pod install. Verify with a Release build before it ships.

3. Driver profile pictures. Manager avatars are done (avatars bucket, admin/<uid>/ paths,
   no anonymous write). Drivers were deliberately deferred: they have no login, so a
   direct upload needs an anonymous INSERT policy like expense-receipts and
   driver-reports already have. Do it instead through connect-driver's existing
   validateDriverIdentity, writing as service_role. The driver/ path prefix is reserved.
   Destination is the manager's fleet list and driver detail.

4. In-app purchase for 2.3.0 — follow docs/IAP_PLAN.md. RevenueCat, both stores.
   ~/Documents/CushyInvoice is the same stack and already shipping it; copy its
   structure but note the two departures the plan calls out (its RevenueCat is iOS-only
   with Android on Stripe/Paystack, which would violate Play's payments policy; and its
   sync is client-triggered only, so renewals and lapses never reach Supabase).

THINGS THAT WILL WASTE YOUR TIME IF NOBODY TELLS YOU:

- `npx tsc --noEmit` checks NOTHING. tsconfig.json has "files": [] and only project
  references, so it exits 0 on any error. Use `npm run typecheck`. Two pre-existing
  errors are expected and harmless: next/link in the unused skiper40.tsx, and the
  app-entry alias in main.tsx.

- Open ios/App/App.xcworkspace, never App.xcodeproj. The bare project fails on
  AppDelegate.swift:2 with "No such module 'Capacitor'" — a line nobody edited, which
  makes it look like a code error. `npx cap open ios` opens the right one.

- Migration history is desynced: ~44 remote-only vs ~44 local-only, in pairs one second
  apart (Lovable timestamp drift). `supabase db push` refuses to run, and the CLI's
  suggested `migration repair --status reverted` would be destructive — it would re-run
  every local twin against tables that already exist. Apply migrations individually:
    npx supabase db query --linked --project-ref invbnyxieoyohahqhbir -f <file>
  That path goes through the Management API and needs only the access token, not the
  separate database password.

- There are TWO projects in this Supabase org. FleetTrackMate is invbnyxieoyohahqhbir;
  legalcliqueltd-dev's project is unrelated. Scope every command with --project-ref.

- user_roles.role = 'admin' gates NOTHING — the signup trigger grants it to every
  account (21 of 21 in production). Platform-operator surfaces use the platform_owner
  role and public.is_platform_owner(). Never gate on 'admin'.

- scripts/verify-native-bundle.sh fails the build if payment/marketing strings reach the
  native bundle. That is what keeps App Store guideline 3.1.3(f) honest. When IAP ships,
  loosen it deliberately — but Stripe, Paystack, create-checkout, create-paystack-checkout
  and fleettrackmate.com must stay forbidden.

- scripts/ios-post-sync.sh asserts things that already caused two upload rejections:
  TARGETED_DEVICE_FAMILY must be "1,2" (ITMS-90101 — an update cannot drop iPad once
  shipped) and UISupportedInterfaceOrientations~ipad must have all four orientations
  (ITMS-90474 — iPad multitasking). Xcode silently deleted the second one. Do not
  "simplify" these guards away.

- Supabase auth emails (reset, confirm) are sent by GoTrue, not by our code, so they
  never touch the Resend sender the edge functions use. Custom SMTP is configured;
  templates in docs/AUTH_EMAILS.md are not yet pasted into the dashboard.

CREDENTIALS AND ACCESS:

- The Supabase access token used previously is revoked. Get a fresh one at
  supabase.com/dashboard/account/tokens. NOTE: SUPABASE_ACCESS_TOKEN in ~/.zshrc
  SHADOWS the keychain credential — if it holds a dead token, every CLI call 401s even
  after a successful `supabase login`. Delete that line as cleanup.

- App Store review account (verified working end-to-end against production):
    manager: applereview@fleettrackmate.com / AppleReview2026!
    driver connection code: TESTCODE

VERIFY BEFORE CLAIMING ANYTHING IS DONE:
    npm run typecheck
    rm -rf dist && VITE_BUILD_TARGET=driver-native npx vite build && bash scripts/verify-native-bundle.sh
    rm -rf dist && npx vite build
    npm run cap:build:ios
    cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App \
      -destination 'generic/platform=iOS' -configuration Release \
      CODE_SIGNING_ALLOWED=NO build

Ask before deploying anything to production Supabase or pushing to main.
```

---

## Not for Claude — these are yours alone

Dashboard and console work no tooling can do:

**Supabase → Authentication.** Still the last blocker on submission; sign-in and
password reset are broken without all three:
- Providers → Google → Authorized Client IDs:
  `268918163192-obcad0161f7blcc97i15vmdb39t9ln5i.apps.googleusercontent.com`
- Providers → Apple → Authorized Client IDs: `app.fleettrackmate.driver`
- URL Configuration → Redirect URLs: `fleettrackmate://auth/callback`,
  `https://fleettrackmate.com/**`, `http://localhost:8080/**`

**Supabase → Email Templates.** Paste the three from `docs/AUTH_EMAILS.md`. Cosmetic
only — deliverability is already fixed by the custom SMTP.

**App Store Connect.** iPad screenshots (the binary declares iPad support, so they are
required); the demo credentials above in App Review Notes; and a note explaining the
business model — the app ships the manager portal with features gated behind a
subscription sold on the web, which satisfies 3.1.3(f), but a reviewer will wonder and
it is better answered in the notes than in an appeal.

**Test on TestFlight before submitting.** Email, Google and Apple sign-in; password
reset; notifications arriving. Those are exactly the paths that were broken, are now
fixed, and have not been verified on a device.
