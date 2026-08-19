#!/bin/bash
# Post-sync script for Android
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Verifies @capacitor/geolocation and @capacitor/camera plugins are preserved
# Ensures AndroidManifest.xml has required permissions and features
# Run after: npx cap sync android

ANDROID_DIR="android"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "[WARN] $ANDROID_DIR not found. Run 'npx cap add android' first."
  exit 0
fi

if [ ! -f "$ANDROID_DIR/gradlew" ] || [ ! -f "$ANDROID_DIR/app/src/main/AndroidManifest.xml" ]; then
  echo "[ERROR] Android platform is incomplete."
  echo "        Missing gradlew or app/src/main/AndroidManifest.xml."
  echo "        Delete android/ and run: npx cap add android"
  exit 1
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

# 2b. CRITICAL: strip Transistorsoft from capacitor.plugins.json too.
# The Gradle exclusion above means the classes are never compiled into the
# APK — but `cap sync` regenerates this JSON from node_modules, and Capacitor
# aborts loading ALL plugins (PluginLoadException) when one classpath is
# missing. That surfaced in the app as: 'Geolocation plugin is not implemented'.
PLUGINS_JSON="$ANDROID_DIR/app/src/main/assets/capacitor.plugins.json"
if [ -f "$PLUGINS_JSON" ] && grep -qi "transistorsoft" "$PLUGINS_JSON"; then
  node -e "
    const fs = require('fs');
    const p = '$PLUGINS_JSON';
    const plugins = JSON.parse(fs.readFileSync(p, 'utf8'));
    const kept = plugins.filter(x => !/transistorsoft/i.test(x.pkg) && !/transistorsoft/i.test(x.classpath));
    fs.writeFileSync(p, JSON.stringify(kept, null, '\t') + '\n');
    console.log('[OK] Removed Transistorsoft from capacitor.plugins.json (' + (plugins.length - kept.length) + ' entries)');
  "
fi

echo ""
echo "[OK] Android build cleaned - Transistorsoft plugin removed (iOS-only)"
echo ""

if [ -f "$ANDROID_DIR/app/src/main/assets/capacitor.config.json" ] && grep -q '"server"' "$ANDROID_DIR/app/src/main/assets/capacitor.config.json"; then
  echo "[ERROR] Generated capacitor.config.json still contains a server block."
  echo "        Native Geolocation can fail when Android loads remote assets instead of bundled dist files."
  echo "        Remove server.url from capacitor.config.ts and sync again."
  exit 1
fi

MANIFEST_FILE="$ANDROID_DIR/app/src/main/AndroidManifest.xml"

# Check if manifest is suspiciously minimal (less than 5 lines)
MANIFEST_LINES=$(wc -l < "$MANIFEST_FILE" | tr -d ' ')
if [ "$MANIFEST_LINES" -lt 5 ]; then
  echo "[WARN] AndroidManifest.xml looks suspiciously minimal ($MANIFEST_LINES lines)."
  echo "       This may cause runtime permission errors even if permissions appear present."
  echo "       Expected at least: uses-permission entries + uses-feature + application tag."
fi

ensure_manifest_permission() {
  local permission="$1"

  if grep -q "$permission" "$MANIFEST_FILE"; then
    echo "[OK] AndroidManifest.xml already includes $permission"
    return
  fi

  awk -v permission="$permission" '
    !inserted && /<application/ {
      print "    <uses-permission android:name=\"" permission "\" />"
      inserted=1
    }
    { print }
  ' "$MANIFEST_FILE" > "$MANIFEST_FILE.tmp" && mv "$MANIFEST_FILE.tmp" "$MANIFEST_FILE"

  echo "[OK] Added $permission to AndroidManifest.xml"
}

ensure_manifest_feature() {
  local feature="$1"

  if grep -q "$feature" "$MANIFEST_FILE"; then
    echo "[OK] AndroidManifest.xml already includes uses-feature $feature"
    return
  fi

  awk -v feature="$feature" '
    !inserted && /<application/ {
      print "    <uses-feature android:name=\"" feature "\" android:required=\"false\" />"
      inserted=1
    }
    { print }
  ' "$MANIFEST_FILE" > "$MANIFEST_FILE.tmp" && mv "$MANIFEST_FILE.tmp" "$MANIFEST_FILE"

  echo "[OK] Added uses-feature $feature to AndroidManifest.xml"
}

echo "--- Manifest Permission Check ---"
ensure_manifest_permission "android.permission.ACCESS_COARSE_LOCATION"
ensure_manifest_permission "android.permission.ACCESS_FINE_LOCATION"
ensure_manifest_permission "android.permission.ACCESS_BACKGROUND_LOCATION"
ensure_manifest_permission "android.permission.FOREGROUND_SERVICE"
ensure_manifest_permission "android.permission.FOREGROUND_SERVICE_LOCATION"
ensure_manifest_permission "android.permission.WAKE_LOCK"
ensure_manifest_feature "android.hardware.location.gps"
echo ""

# 3. Verify required Capacitor plugins are present
echo "--- Plugin Verification ---"

verify_plugin() {
  local PLUGIN_NAME="$1"
  local PLUGIN_DIR_NAME="$2"
  local NPM_PATH="$3"
  local FOUND=0

  for file in \
    "$ANDROID_DIR/capacitor.settings.gradle" \
    "$ANDROID_DIR/app/capacitor.settings.gradle" \
    "$ANDROID_DIR/settings.gradle"
  do
    if [ -f "$file" ] && grep -q "$PLUGIN_DIR_NAME" "$file"; then
      echo "[OK] $PLUGIN_NAME plugin found in $file"
      FOUND=1
    fi
  done

  if [ -d "$ANDROID_DIR/$PLUGIN_DIR_NAME" ] || [ -d "$ANDROID_DIR/app/$PLUGIN_DIR_NAME" ]; then
    echo "[OK] $PLUGIN_NAME plugin native directory exists"
    FOUND=1
  fi

  if [ -d "$NPM_PATH" ]; then
    echo "[OK] $PLUGIN_NAME Android source found in node_modules"
  else
    echo "[WARN] $PLUGIN_NAME Android source NOT found in node_modules"
    echo "       Run: npm install @capacitor/$(echo $PLUGIN_DIR_NAME | sed 's/capacitor-//')"
  fi

  if [ "$FOUND" -eq 0 ]; then
    echo ""
    echo "[WARN] $PLUGIN_NAME plugin NOT found in Gradle config!"
    echo "       The plugin may not be registered. Try:"
    echo "       1. Delete the android/ folder entirely"
    echo "       2. Run: npx cap add android"
    echo "       3. Run: npm run build"
    echo "       4. Run: npm run cap:sync:android"
    echo "       5. Run this script again"
  fi
}

verify_plugin "Geolocation" "capacitor-geolocation" "node_modules/@capacitor/geolocation/android"
echo ""
verify_plugin "Camera" "capacitor-camera" "node_modules/@capacitor/camera/android"

echo ""
echo "--- End Verification ---"
echo ""
echo "IMPORTANT: Always use 'npm run cap:sync:android' instead of plain 'npx cap sync android'"
echo "           to ensure this post-sync script runs automatically."
