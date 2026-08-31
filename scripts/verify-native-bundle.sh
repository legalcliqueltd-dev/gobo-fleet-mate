#!/bin/bash
# Verify the iOS / Android Capacitor bundle does not contain any admin,
# marketing, or subscription strings — the contractual basis for relying on
# App Store guideline 3.1.3(f) "Free stand-alone companion app".
#
# Run after `npm run build:native`. Exits non-zero if any forbidden string is
# present so it can gate the iOS and Android sync steps.

set -uo pipefail

DIST_DIR="dist/assets"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ $DIST_DIR not found. Run 'npm run build:native' first."
  exit 1
fi

# Strings that must NOT appear in the native JS bundle.
# Patterns are intentionally specific so they only fire on user-facing CTAs
# and brand strings, not on framework / SDK method names that happen to
# substring-match (e.g. Supabase realtime's `subscribe()` vs the UI string
# "Subscribe Now"). If you legitimately need one of these (e.g. add Apple IAP
# later), update this list deliberately.
FORBIDDEN=(
  "Stripe"                       # payment processor brand
  "Paystack"                     # payment processor brand
  "Subscribe Now"                # CTA from web admin
  "Subscribe to "                # CTA prefix from PaymentWall
  "Trial Expired"                # admin trial-state copy
  "Upgrade to Pro"               # admin upsell copy
  "Pay Now"                      # admin CTA
  "create-checkout"              # Stripe edge function name
  "create-paystack-checkout"     # Paystack edge function name
  "Rocket Driver"                # alternate brand
  "Download APK"                 # Android sideload CTA
  "FleetTrackMate Driver APK"    # Android sideload copy
  "Google Play"
  "Play Store"
  "/downloads/FleetTrackMate"    # APK URL prefix
  "fleettrackmate.com"           # see below
  "Plans are managed"            # "…on fleettrackmate.com" — same reason
)

# On the domain: 3.1.3(f) bars "purchasing inside the app, OR calls to action
# for purchase outside of the app". Telling a locked-out manager where to go
# and subscribe is the second kind, so the native bundle names no website at
# all. The Privacy and Terms screens shipped in this bundle deliberately
# identify the company by name and email rather than by URL, which is why a
# blanket ban on the domain does not fight them.

# Allow Android (the platform name) to appear because it is referenced by
# Capacitor's platform-detection utility (Capacitor.getPlatform() === 'android').
# Stripping that would break dual-platform builds.

failed=0
for str in "${FORBIDDEN[@]}"; do
  matches=$(grep -lF -- "$str" "$DIST_DIR"/*.js 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "❌ Forbidden string '$str' found in bundle:"
    echo "$matches" | sed 's/^/   /'
    failed=1
  fi
done

if [ "$failed" -eq 1 ]; then
  echo ""
  echo "Bundle verification FAILED. The native build contains admin or marketing"
  echo "strings that should be tree-shaken by the VITE_BUILD_TARGET=driver-native"
  echo "flag. Investigate the failing strings, remove their imports from the"
  echo "driver flow, and rebuild."
  exit 1
fi

echo "✅ Native bundle verified: no admin / marketing / subscription strings present."
