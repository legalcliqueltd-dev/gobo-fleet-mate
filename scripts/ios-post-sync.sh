#!/bin/bash
# iOS Post-Sync Script
# Automatically injects required Info.plist entries after npx cap add/sync ios
# Usage: ./scripts/ios-post-sync.sh

PLIST_PATH="ios/App/App/Info.plist"

if [ ! -f "$PLIST_PATH" ]; then
  echo "❌ Info.plist not found at $PLIST_PATH"
  echo "   Run 'npx cap add ios' first."
  exit 1
fi

echo "📍 Ensuring required permission entries exist in Info.plist..."

auto_insert_before_dict_close() {
  local insert_block="$1"
  # macOS sed requires backup extension with -i
  sed -i '' "s|</dict>|${insert_block}\\
</dict>|" "$PLIST_PATH"
}

ensure_key_string() {
  local key="$1"
  local value="$2"

  if grep -q "<key>${key}</key>" "$PLIST_PATH"; then
    return
  fi

  echo "➕ Adding ${key}"
  auto_insert_before_dict_close "<key>${key}</key>\\
<string>${value}</string>"
}

ensure_ui_background_modes() {
  if grep -q "<key>UIBackgroundModes</key>" "$PLIST_PATH"; then
    return
  fi

  echo "➕ Adding UIBackgroundModes"
  auto_insert_before_dict_close "<key>UIBackgroundModes</key>\\
<array>\\
<string>location</string>\\
<string>fetch</string>\\
<string>processing</string>\\
</array>"
}

ensure_key_string "NSLocationWhenInUseUsageDescription" "FleetTrackMate needs your location to share your position with your fleet manager."
ensure_key_string "NSLocationAlwaysAndWhenInUseUsageDescription" "FleetTrackMate needs continuous location access to track your position even when the app is in the background."
ensure_key_string "NSMotionUsageDescription" "FleetTrackMate uses motion data to optimize battery usage during location tracking."
ensure_key_string "NSCameraUsageDescription" "FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof."
ensure_key_string "NSPhotoLibraryUsageDescription" "FleetTrackMate needs photo library access to select photos and videos for emergency reports and delivery proof."
ensure_key_string "NSPhotoLibraryAddUsageDescription" "FleetTrackMate needs permission to save captured media to your library."
ensure_key_string "NSMicrophoneUsageDescription" "FleetTrackMate needs microphone access when recording delivery proof videos."
ensure_ui_background_modes

echo "✅ Info.plist permission entries ensured successfully!"

echo ""
echo "📋 Verification:"
grep -A1 "NSLocation" "$PLIST_PATH" || echo "⚠️  NSLocation entries not found"
echo ""
grep -A2 "UIBackgroundModes" "$PLIST_PATH" || echo "⚠️  UIBackgroundModes not found"

echo ""
echo "🔧 Next steps:"
echo "   1. Open Xcode: npx cap open ios"
echo "   2. Add Background Modes capability and check 'Location updates'"
echo "   3. Clean Build (⇧⌘K) and Run (⌘R)"
