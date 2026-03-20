#!/bin/bash
# Post-sync script for Android
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Run after: npx cap sync android

ANDROID_DIR="android"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "⚠️  $ANDROID_DIR not found. Run 'npx cap add android' first."
  exit 0
fi

# 1. Remove Transistorsoft settings entry from android/settings.gradle
SETTINGS_FILE="$ANDROID_DIR/settings.gradle"
if [ -f "$SETTINGS_FILE" ] && grep -q "transistorsoft" "$SETTINGS_FILE"; then
  sed -i.bak '/transistorsoft/d' "$SETTINGS_FILE"
  rm -f "${SETTINGS_FILE}.bak"
  echo "✅ Removed Transistorsoft from $SETTINGS_FILE"
fi

# 2. Remove Transistorsoft dependency from android/app/build.gradle
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
if [ -f "$APP_GRADLE" ] && grep -q "transistorsoft" "$APP_GRADLE"; then
  sed -i.bak '/transistorsoft/d' "$APP_GRADLE"
  rm -f "${APP_GRADLE}.bak"
  echo "✅ Removed Transistorsoft from $APP_GRADLE"
fi

# 3. Remove Transistorsoft Maven repo from android/build.gradle
ROOT_GRADLE="$ANDROID_DIR/build.gradle"
if [ -f "$ROOT_GRADLE" ] && grep -q "transistorsoft" "$ROOT_GRADLE"; then
  sed -i.bak '/transistorsoft/d' "$ROOT_GRADLE"
  rm -f "${ROOT_GRADLE}.bak"
  echo "✅ Removed Transistorsoft Maven repo from $ROOT_GRADLE"
fi

# 4. Remove the Transistorsoft native module directory if it exists
TSL_DIR="$ANDROID_DIR/transistorsoft-capacitor-background-geolocation"
if [ -d "$TSL_DIR" ]; then
  rm -rf "$TSL_DIR"
  echo "✅ Removed $TSL_DIR directory"
fi

TSL_FETCH_DIR="$ANDROID_DIR/transistorsoft-capacitor-background-fetch"
if [ -d "$TSL_FETCH_DIR" ]; then
  rm -rf "$TSL_FETCH_DIR"
  echo "✅ Removed $TSL_FETCH_DIR directory"
fi

echo "✅ Android build cleaned — Transistorsoft plugin removed (iOS-only)"
