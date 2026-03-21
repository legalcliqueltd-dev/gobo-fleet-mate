#!/bin/bash
# Post-sync script for Android
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Run after: npx cap sync android

ANDROID_DIR="android"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "⚠️  $ANDROID_DIR not found. Run 'npx cap add android' first."
  exit 0
fi

# 1. Remove Transistorsoft entries from Gradle files
clean_gradle_file() {
  local file="$1"
  if [ -f "$file" ] && grep -qi "transistorsoft" "$file"; then
    sed -i.bak '/transistorsoft/d' "$file"
    rm -f "${file}.bak"
    echo "✅ Removed Transistorsoft from $file"
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
    echo "✅ Removed $dir directory"
  fi
done

echo "✅ Android build cleaned — Transistorsoft plugin removed (iOS-only)"
