# In-app purchase — plan for 2.3.0

Not in the current submission. Ship the 3.1.3(f) build first, get approved,
then add this as a normal update where a rejection costs nothing already live.

Reference implementation: `~/Documents/CushyInvoice`, same stack (Capacitor +
Supabase + shadcn), already shipping RevenueCat and already approved. Patterns
below follow it except where noted — the exceptions matter.

---

## 1. Why not what was originally asked for

Apple Pay and Stripe were the original request for iOS. Both are rejections:

- **3.1.1** — "If you want to unlock features or functionality within your app
  (by way of example: **subscriptions**…), you must use in-app purchase."
- **3.1.3(e)** — Apple Pay is named for "**physical** goods or services that
  will be **consumed outside of the app**."

A fleet subscription is digital and consumed in-app, so StoreKit is the only
compliant in-app route. Google Play's payments policy is the mirror image.

## 2. The thing to fix rather than copy

CushyInvoice runs RevenueCat **on iOS only** — `isIOSNative()` gates every
call, and its own comment says "Web/Android fall back to Stripe/Paystack".

If the Android build shows Stripe or Paystack checkout for a digital
subscription, that violates Google Play's payments policy. That is worse than
an App Store rejection because it lands on a **live** app as a takedown rather
than at review time. Worth auditing CushyInvoice separately.

For FleetTrackMate, RevenueCat covers both stores. Configure a Google API key
alongside the Apple one and drop the iOS-only gate:

```ts
const API_KEY = isIOS() ? IOS_API_KEY : ANDROID_API_KEY;
```

Web keeps Stripe and Paystack, which is fine and is what 3.1.3(b) contemplates.

## 3. The other gap to close

CushyInvoice's sync is **client-triggered only**: `revenuecat-sync` runs when
the app calls it after a purchase or restore. Nothing tells Supabase when a
subscription renews, lapses, is refunded, or fails to bill.

The consequence is a subscription that expired last month still reading
`active` in `profiles` until the user happens to open the app — access granted
to someone who stopped paying, and no signal when a renewal fails.

So in addition to the client-triggered sync, add a **RevenueCat webhook** →
new `revenuecat-webhook` edge function, `verify_jwt = false`, authenticated by
the shared secret RevenueCat sends in the `Authorization` header. Handle
`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`,
`PRODUCT_CHANGE`.

## 4. Two tiers, not one

CushyInvoice has a single `premium` entitlement. FleetTrackMate has Basic and
Pro, and `useEntitlements` already distinguishes them (`canUseStations` is
Pro-or-trial; `driverLimit` is 2 vs Infinity).

Create **two entitlements** in RevenueCat — `basic` and `pro` — rather than one
plus product-string sniffing. `useEntitlements` then keeps working untouched,
which is the whole point: the app should not learn where the money came from.

Products to create in both consoles:

| Tier | Product ID | Price |
| --- | --- | --- |
| Basic monthly | `app.fleettrackmate.driver.basic.monthly` | $1.99 |
| Pro monthly | `app.fleettrackmate.driver.pro.monthly` | $3.99 |

## 5. Where it plugs into what already exists

The critical constraint: **write into the existing subscription shape**, do not
invent a parallel one. `AuthContext` calls `check-subscription`, which reads
`profiles.subscription_status` / `subscription_plan` / `subscription_end_at`.
`useEntitlements` reads that. Every gate in the app already depends on it.

So the sync and the webhook both write those same columns, with
`payment_provider = 'apple_iap'` or `'google_play'` — mirroring how the
platform console writes `'manual'` for a granted plan. Nothing downstream
changes.

Also mirror `admin_subscriptions.plan_name` / `driver_limit`, for the same
reason `grant-plan` does: leaving them disagreeing puts someone on Pro with a
Basic driver cap.

## 6. Files

```
src/lib/revenuecat.ts              init, offerings, purchase, restore
src/hooks/useRevenueCat.ts         offerings + retry, purchase, restore, sync
src/components/admin/Paywall.tsx   the native purchase screen
supabase/functions/revenuecat-sync/     client-triggered pull (server verifies)
supabase/functions/revenuecat-webhook/  renewals, lapses, refunds
```

Follow CushyInvoice's structure: lazy `import()` so the web bundle never pays
for the SDK, singleton init guarded by a promise, `appUserID` set to the
Supabase user id — that last one is what lets the webhook map a RevenueCat
customer back to a row.

Never trust the client's word that a purchase succeeded. CushyInvoice gets this
right: the client only *triggers* the sync, and the edge function independently
asks RevenueCat's REST API what the truth is.

## 7. Apple 3.1.2 — the paywall has required furniture

Missing any of these is a rejection on its own. CushyInvoice's approved
`Subscribe.tsx` has them all; copy the checklist:

- **Restore Purchases** button — its own comment reads "required by Apple"
- Title, duration and price of each subscription, using RevenueCat's localised
  `product.priceString` rather than a hardcoded `$1.99`
- Auto-renew disclosure: renews unless turned off at least 24 hours before the
  period ends
- **Terms of Use (EULA)** and **Privacy Policy** links, in the app *and* in the
  App Store Connect metadata fields
- "Cancel anytime in Settings" on iOS — cancellation is Apple's to handle, and
  offering your own cancel button for an IAP subscription confuses matters

## 8. The build gate has to change deliberately

`scripts/verify-native-bundle.sh` currently **fails the build** if the native
bundle contains `Stripe`, `Paystack`, `Subscribe to `, `Upgrade to Pro` and so
on. That is what has kept the 3.1.3(f) position honest.

Its own comment anticipates this: *"If you legitimately need one of these (e.g.
add Apple IAP later), update this list deliberately."*

Once IAP ships the app is compliant under 3.1.1 instead of 3.1.3(f), so
purchase UI is allowed — but `Stripe`, `Paystack`, `create-checkout`,
`create-paystack-checkout` and `fleettrackmate.com` must **stay** forbidden.
Those are the ones that would make it look like you are steering users to an
external processor, which remains a rejection. Remove only the generic CTA
strings.

## 9. Console work — blocks the code, so start early

Both take days to clear and neither is a code task.

- **App Store Connect**: Paid Apps agreement active, banking and tax forms
  complete, the two subscription products created and submitted for review
- **Play Console**: merchant account, the two subscription products
- **RevenueCat**: project, both apps, App Store shared secret, Play service
  account JSON, the `basic`/`pro` entitlements mapped to products, webhook URL
- **Supabase secrets**: `REVENUECAT_REST_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`

## 10. Capacitor version

CushyInvoice is on Capacitor 8 with `@revenuecat/purchases-capacitor@13`.
FleetTrackMate is on Capacitor 7, and RevenueCat 12+ requires Capacitor 8.

Either use RevenueCat **11.x** (supports Capacitor ≥7, no upgrade), or upgrade
FleetTrackMate to Capacitor 8 for parity with the other app. The upgrade is not
something to attempt in the same change as IAP — do it separately, with its own
device test, or take 11.x and defer.
