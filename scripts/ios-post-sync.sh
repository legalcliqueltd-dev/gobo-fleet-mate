#!/bin/bash
# iOS Post-Sync Script
# Automatically injects required Info.plist entries after npx cap add/sync ios
# Usage: ./scripts/ios-post-sync.sh
#
# This script uses PlistBuddy (Apple's native plist tool) instead of sed
# to ensure keys are added to the root dictionary, not nested elements.

PLIST_PATH="ios/App/App/Info.plist"
PLIST_BUDDY="/usr/libexec/PlistBuddy"

if [ ! -f "$PLIST_PATH" ]; then
  echo "❌ Info.plist not found at $PLIST_PATH"
  echo "   Run 'npx cap add ios' first."
  exit 1
fi

if [ ! -x "$PLIST_BUDDY" ]; then
  echo "❌ PlistBuddy not found at $PLIST_BUDDY"
  echo "   This script requires macOS with Xcode installed."
  exit 1
fi

echo "📍 Ensuring required permission entries exist in Info.plist..."
echo ""

# Function to add a string key if it doesn't exist
add_string_key() {
  local key="$1"
  local value="$2"
  
  # Check if key exists
  if $PLIST_BUDDY -c "Print :$key" "$PLIST_PATH" 2>/dev/null; then
    echo "✓ $key (already exists)"
  else
    $PLIST_BUDDY -c "Add :$key string '$value'" "$PLIST_PATH"
    echo "➕ $key (added)"
  fi
}

# Function to ensure UIBackgroundModes array exists with required values
add_background_modes() {
  local modes=("location" "fetch" "processing")
  
  # Check if UIBackgroundModes exists
  if ! $PLIST_BUDDY -c "Print :UIBackgroundModes" "$PLIST_PATH" 2>/dev/null; then
    # Create the array
    $PLIST_BUDDY -c "Add :UIBackgroundModes array" "$PLIST_PATH"
    echo "➕ UIBackgroundModes (created array)"
  else
    echo "✓ UIBackgroundModes (array exists)"
  fi
  
  # Add each mode if not present
  for mode in "${modes[@]}"; do
    # Check if mode already exists in array
    local exists=false
    local i=0
    while true; do
      local current=$($PLIST_BUDDY -c "Print :UIBackgroundModes:$i" "$PLIST_PATH" 2>/dev/null)
      if [ $? -ne 0 ]; then
        break
      fi
      if [ "$current" = "$mode" ]; then
        exists=true
        break
      fi
      ((i++))
    done
    
    if [ "$exists" = false ]; then
      $PLIST_BUDDY -c "Add :UIBackgroundModes: string '$mode'" "$PLIST_PATH"
      echo "   ➕ Added '$mode' to UIBackgroundModes"
    else
      echo "   ✓ '$mode' already in UIBackgroundModes"
    fi
  done
}

echo "=== Location Permissions ==="
add_string_key "NSLocationWhenInUseUsageDescription" "FleetTrackMate shares your live location with your fleet manager while you are on shift, so they can see where you are, route the next job to you, and send help if you raise an SOS."
add_string_key "NSLocationAlwaysAndWhenInUseUsageDescription" "FleetTrackMate keeps sharing your location with your fleet manager while a shift is running, including when the app is in the background or your screen is off, so your route, stops and station visits are recorded without you having to keep the app open. Tracking stops when you end your shift or disconnect."
add_string_key "NSMotionUsageDescription" "FleetTrackMate uses motion data to detect when your vehicle has stopped so it can pause GPS updates and save your battery."

echo ""
echo "=== Camera & Media Permissions ==="
add_string_key "NSCameraUsageDescription" "FleetTrackMate uses the camera for delivery proof, station visit photos, shift-start vehicle checks and expense receipts."
add_string_key "NSPhotoLibraryUsageDescription" "FleetTrackMate lets you attach a photo you already have as an expense receipt or a problem report."

echo ""
echo "=== App Store hygiene ==="
# Name shown on the home screen. Matches android/app/src/main/res/values/strings.xml
# — the native app carries both the driver and manager faces, so it is not
# "FleetTrackMate Driver" any more.
if [ "$($PLIST_BUDDY -c "Print :CFBundleDisplayName" "$PLIST_PATH" 2>/dev/null)" = "FleetTrackMate" ]; then
  echo "✓ CFBundleDisplayName (FleetTrackMate)"
else
  $PLIST_BUDDY -c "Set :CFBundleDisplayName FleetTrackMate" "$PLIST_PATH" 2>/dev/null \
    || $PLIST_BUDDY -c "Add :CFBundleDisplayName string FleetTrackMate" "$PLIST_PATH"
  echo "➕ CFBundleDisplayName (set to FleetTrackMate)"
fi

# Answers the export-compliance question at build time rather than on every
# single upload. False is correct: the app uses only standard HTTPS/TLS.
if $PLIST_BUDDY -c "Print :ITSAppUsesNonExemptEncryption" "$PLIST_PATH" >/dev/null 2>&1; then
  echo "✓ ITSAppUsesNonExemptEncryption"
else
  $PLIST_BUDDY -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST_PATH"
  echo "➕ ITSAppUsesNonExemptEncryption (false)"
fi

# Capacitor's template still ships armv7, an architecture iOS dropped at 11.
if $PLIST_BUDDY -c "Print :UIRequiredDeviceCapabilities" "$PLIST_PATH" 2>/dev/null | grep -q armv7; then
  $PLIST_BUDDY -c "Delete :UIRequiredDeviceCapabilities" "$PLIST_PATH"
  $PLIST_BUDDY -c "Add :UIRequiredDeviceCapabilities array" "$PLIST_PATH"
  $PLIST_BUDDY -c "Add :UIRequiredDeviceCapabilities: string arm64" "$PLIST_PATH"
  echo "➕ UIRequiredDeviceCapabilities (armv7 → arm64)"
else
  echo "✓ UIRequiredDeviceCapabilities"
fi

echo ""
echo "=== Background Modes ==="
add_background_modes

echo ""
echo "=== BGTaskScheduler Permitted Identifiers ==="
# Required when UIBackgroundModes includes 'processing'
if ! $PLIST_BUDDY -c "Print :BGTaskSchedulerPermittedIdentifiers" "$PLIST_PATH" 2>/dev/null; then
  $PLIST_BUDDY -c "Add :BGTaskSchedulerPermittedIdentifiers array" "$PLIST_PATH"
  echo "➕ BGTaskSchedulerPermittedIdentifiers (created array)"
else
  echo "✓ BGTaskSchedulerPermittedIdentifiers (array exists)"
fi

# Add Transistorsoft background-geolocation identifiers
for bg_id in "com.transistorsoft.fetch" "com.transistorsoft.customtask"; do
  bg_exists=false
  i=0
  while true; do
    current=$($PLIST_BUDDY -c "Print :BGTaskSchedulerPermittedIdentifiers:$i" "$PLIST_PATH" 2>/dev/null)
    if [ $? -ne 0 ]; then break; fi
    if [ "$current" = "$bg_id" ]; then bg_exists=true; break; fi
    ((i++))
  done
  if [ "$bg_exists" = false ]; then
    $PLIST_BUDDY -c "Add :BGTaskSchedulerPermittedIdentifiers: string '$bg_id'" "$PLIST_PATH"
    echo "   ➕ Added '$bg_id'"
  else
    echo "   ✓ '$bg_id' already present"
  fi
done

echo ""
echo "=== Google Sign-In URL Scheme ==="
# GoogleSignIn 9.x returns from the OAuth flow through a custom URL scheme built
# by reversing the iOS client ID. Without it registered here the account sheet
# opens and never comes back to the app.
#
# Driven by VITE_GOOGLE_IOS_CLIENT_ID so .env stays the single source of truth.
# While that value is empty we leave Info.plist untouched and adminAuth falls
# back to the system-browser flow, so the app always has a working sign-in.
GOOGLE_IOS_CLIENT_ID="$(grep -E '^VITE_GOOGLE_IOS_CLIENT_ID=' .env 2>/dev/null | head -1 | cut -d '=' -f 2- | tr -d "\"' \r")"

if [ -z "$GOOGLE_IOS_CLIENT_ID" ]; then
  echo "⏭  VITE_GOOGLE_IOS_CLIENT_ID is empty — skipped."
  echo "   Google sign-in on iOS will use the system-browser fallback."
else
  # 268918163192-abc.apps.googleusercontent.com
  #   -> com.googleusercontent.apps.268918163192-abc
  REVERSED_CLIENT_ID="com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID%%.apps.googleusercontent.com}"

  if $PLIST_BUDDY -c "Print :CFBundleURLTypes" "$PLIST_PATH" 2>/dev/null | grep -q "$REVERSED_CLIENT_ID"; then
    echo "✓ $REVERSED_CLIENT_ID (already registered)"
  else
    # Ensure the container exists before appending to it.
    $PLIST_BUDDY -c "Print :CFBundleURLTypes" "$PLIST_PATH" >/dev/null 2>&1 \
      || $PLIST_BUDDY -c "Add :CFBundleURLTypes array" "$PLIST_PATH"

    # Append a new entry, leaving the existing fleettrackmate:// entry alone.
    idx=0
    while $PLIST_BUDDY -c "Print :CFBundleURLTypes:$idx" "$PLIST_PATH" >/dev/null 2>&1; do
      idx=$((idx + 1))
    done

    $PLIST_BUDDY -c "Add :CFBundleURLTypes:$idx dict" "$PLIST_PATH"
    $PLIST_BUDDY -c "Add :CFBundleURLTypes:$idx:CFBundleURLName string app.fleettrackmate.driver.google" "$PLIST_PATH"
    $PLIST_BUDDY -c "Add :CFBundleURLTypes:$idx:CFBundleURLSchemes array" "$PLIST_PATH"
    $PLIST_BUDDY -c "Add :CFBundleURLTypes:$idx:CFBundleURLSchemes: string $REVERSED_CLIENT_ID" "$PLIST_PATH"
    echo "➕ $REVERSED_CLIENT_ID (registered)"
  fi
fi

echo ""
echo "✅ Info.plist permission entries ensured successfully!"
echo ""

# Verification - show all permission-related keys
echo "📋 Verification (current values):"
echo "─────────────────────────────────"
for key in "NSLocationWhenInUseUsageDescription" "NSLocationAlwaysAndWhenInUseUsageDescription" "NSMotionUsageDescription" "NSCameraUsageDescription" "NSPhotoLibraryUsageDescription"; do
  value=$($PLIST_BUDDY -c "Print :$key" "$PLIST_PATH" 2>/dev/null)
  if [ $? -eq 0 ]; then
    # Truncate long values for display
    if [ ${#value} -gt 50 ]; then
      value="${value:0:50}..."
    fi
    echo "✓ $key"
  else
    echo "✗ $key (MISSING!)"
  fi
done

echo ""
echo "UIBackgroundModes:"
$PLIST_BUDDY -c "Print :UIBackgroundModes" "$PLIST_PATH" 2>/dev/null || echo "  (not found)"

echo ""
echo "=== Native plugin wiring ==="
# Three separate things have to agree before a notification can fire on iOS,
# and each has failed silently here before:
#   1. the plugin is listed in the generated capacitor.config.json
#   2. its pod is installed (Podfile.lock, not just Podfile)
#   3. the sound files are members of the App target
# A miss on any one of them shows up as "notifications just don't work on
# iPhone" with nothing in the logs, so they are checked loudly instead.
wiring_ok=1

GEN_CONFIG="ios/App/App/capacitor.config.json"
if [ -f "$GEN_CONFIG" ] && grep -q "@capacitor/local-notifications" "$GEN_CONFIG"; then
  echo "✓ @capacitor/local-notifications in capacitor.config.json"
else
  echo "✗ @capacitor/local-notifications MISSING from $GEN_CONFIG"
  echo "   Driver job / station / SOS alerts will be silent on iOS."
  wiring_ok=0
fi

if grep -q "CapacitorLocalNotifications" ios/App/Podfile.lock 2>/dev/null; then
  echo "✓ CapacitorLocalNotifications pod installed"
else
  echo "✗ CapacitorLocalNotifications NOT in Podfile.lock — run: (cd ios/App && pod install)"
  wiring_ok=0
fi

for sound in alert.wav chime.wav; do
  if grep -q "$sound in Resources" ios/App/App.xcodeproj/project.pbxproj 2>/dev/null; then
    echo "✓ $sound is a member of the App target"
  else
    echo "✗ $sound is on disk but NOT in the Xcode Resources build phase"
    echo "   iOS resolves notification sounds by bundle filename; it will be silent."
    wiring_ok=0
  fi
done

if [ "$wiring_ok" -eq 0 ]; then
  echo ""
  echo "⚠️  Native plugin wiring is incomplete — fix the ✗ lines above before archiving."
fi

echo ""
echo "─────────────────────────────────"
echo "🔧 Next steps:"
echo "   1. Open Xcode: npx cap open ios"
echo "   2. Verify permissions in Info.plist (should see Camera, Photos, etc.)"
echo "   3. Add Background Modes capability if not already added"
echo "   4. Clean Build (⇧⌘K) and Run (⌘R)"
