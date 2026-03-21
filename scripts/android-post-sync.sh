#!/bin/bash
# Post-sync script for Android
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Verifies @capacitor/geolocation plugin is preserved
# Run after: npx cap sync android

ANDROID_DIR="android"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "[WARN] $ANDROID_DIR not found. Run 'npx cap add android' first."
  exit 0
fi

# 1. Remove Transistorsoft entries from Gradle files
clean_gradle_file() {
  local file="$1"
  if [ -f "$file" ] && grep -qi "transistorsoft" "$file"; then
    sed -i.bak '/transistorsoft/d' "$file"
    rm -f "${file}.bak"
    echo "[OK] Removed Transistorsoft from $file"
  fi
}

for file in \
  "$ANDROID_DIR/settings.gradle" \
  "$ANDROID_DIR/build.gradle" \
  "$ANDROID_DIR/app/build.gradle" \
  "$ANDROID_DIR/app/capacitor.settings.gradle" \
  "$ANDROID_DIR/app/capacitor.build.gradle" \
  "$ANDROID_DIR/capacitor.settings.gradle" \
  "$ANDROID_DIR/capacitor.build.gradle"
do
  clean_gradle_file "$file"
done

# 2. Remove the Transistorsoft native module directories if they exist
for dir in \
  "$ANDROID_DIR/transistorsoft-capacitor-background-geolocation" \
  "$ANDROID_DIR/transistorsoft-capacitor-background-fetch" \
  "$ANDROID_DIR/app/transistorsoft-capacitor-background-geolocation" \
  "$ANDROID_DIR/app/transistorsoft-capacitor-background-fetch"
do
  if [ -d "$dir" ]; then
rm -rf "$dir"
    echo "[OK] Removed $dir directory"
  fi
done

echo ""
echo "[OK] Android build cleaned - Transistorsoft plugin removed (iOS-only)"
echo ""

# 3. Verify @capacitor/geolocation plugin is present
echo "--- Plugin Verification ---"

GEO_FOUND=0

for file in \
  "$ANDROID_DIR/capacitor.settings.gradle" \
  "$ANDROID_DIR/app/capacitor.settings.gradle" \
  "$ANDROID_DIR/settings.gradle"
do
  if [ -f "$file" ] && grep -q "capacitor-geolocation" "$file"; then
    echo "[OK] Geolocation plugin found in $file"
    GEO_FOUND=1
  fi
done

if [ -d "$ANDROID_DIR/capacitor-geolocation" ] || [ -d "$ANDROID_DIR/app/capacitor-geolocation" ]; then
  echo "[OK] Geolocation plugin native directory exists"
  GEO_FOUND=1
fi

if [ -d "node_modules/@capacitor/geolocation/android" ]; then
  echo "[OK] @capacitor/geolocation Android source found in node_modules"
else
  echo "[WARN] @capacitor/geolocation Android source NOT found in node_modules"
  echo "       Run: npm install @capacitor/geolocation"
fi

if [ "$GEO_FOUND" -eq 0 ]; then
  echo ""
  echo "[WARN] Geolocation plugin NOT found in Gradle config!"
  echo "       The plugin may not be registered. Try:"
  echo "       1. Delete the android/ folder entirely"
  echo "       2. Run: npx cap add android"
  echo "       3. Run: npx cap sync android"
  echo "       4. Run this script again"
fi

echo ""
echo "--- End Verification ---"
