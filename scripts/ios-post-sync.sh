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
add_string_key "NSLocationWhenInUseUsageDescription" "FleetTrackMate needs your location to share your position with your fleet manager."
add_string_key "NSLocationAlwaysAndWhenInUseUsageDescription" "FleetTrackMate needs continuous location access to track your position even when the app is in the background."
add_string_key "NSMotionUsageDescription" "FleetTrackMate uses motion data to optimize battery usage during location tracking."

echo ""
echo "=== Camera & Media Permissions ==="
add_string_key "NSCameraUsageDescription" "FleetTrackMate needs camera access to capture photos for emergency reports and delivery proof."
add_string_key "NSPhotoLibraryUsageDescription" "FleetTrackMate needs photo library access to select photos and videos for emergency reports and delivery proof."
add_string_key "NSPhotoLibraryAddUsageDescription" "FleetTrackMate needs permission to save captured media to your library."
add_string_key "NSMicrophoneUsageDescription" "FleetTrackMate needs microphone access when recording delivery proof videos."

echo ""
echo "=== Background Modes ==="
add_background_modes

echo ""
echo "✅ Info.plist permission entries ensured successfully!"
echo ""

# Verification - show all permission-related keys
echo "📋 Verification (current values):"
echo "─────────────────────────────────"
for key in "NSLocationWhenInUseUsageDescription" "NSLocationAlwaysAndWhenInUseUsageDescription" "NSMotionUsageDescription" "NSCameraUsageDescription" "NSPhotoLibraryUsageDescription" "NSPhotoLibraryAddUsageDescription" "NSMicrophoneUsageDescription"; do
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
echo "─────────────────────────────────"
echo "🔧 Next steps:"
echo "   1. Open Xcode: npx cap open ios"
echo "   2. Verify permissions in Info.plist (should see Camera, Photos, etc.)"
echo "   3. Add Background Modes capability if not already added"
echo "   4. Clean Build (⇧⌘K) and Run (⌘R)"
