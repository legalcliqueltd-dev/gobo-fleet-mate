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

echo "📍 Injecting location permission entries into Info.plist..."

# Check if entries already exist
if grep -q "NSLocationWhenInUseUsageDescription" "$PLIST_PATH"; then
  echo "✅ Location entries already present in Info.plist"
else
  # Use sed to inject entries before closing </dict>
  # macOS sed requires backup extension with -i
  sed -i '' 's|</dict>|<key>NSLocationWhenInUseUsageDescription</key>\
<string>FleetTrackMate needs your location to share your position with your fleet manager.</string>\
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>\
<string>FleetTrackMate needs continuous location access to track your position even when the app is in the background.</string>\
<key>NSMotionUsageDescription</key>\
<string>FleetTrackMate uses motion data to optimize battery usage during location tracking.</string>\
<key>NSCameraUsageDescription</key>\
<string>FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof.</string>\
<key>NSPhotoLibraryUsageDescription</key>\
<string>FleetTrackMate needs photo library access to select photos for emergency reports and delivery proof.</string>\
<key>NSPhotoLibraryAddUsageDescription</key>\
<string>FleetTrackMate needs permission to save captured photos to your library.</string>\
<key>UIBackgroundModes</key>\
<array>\
<string>location</string>\
<string>fetch</string>\
<string>processing</string>\
</array>\
</dict>|' "$PLIST_PATH"

  echo "✅ Location permission entries injected successfully!"
fi

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
