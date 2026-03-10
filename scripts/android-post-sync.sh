#!/bin/bash
# Post-sync script for Android: adds Transistorsoft Maven repository
# Run after: npx cap sync android

GRADLE_FILE="android/build.gradle"

if [ ! -f "$GRADLE_FILE" ]; then
  echo "⚠️  $GRADLE_FILE not found. Run 'npx cap add android' first."
  exit 0
fi

# Check if the maven repo is already added
if grep -q "transistorsoft-capacitor-background-geolocation" "$GRADLE_FILE"; then
  echo "✅ Transistorsoft Maven repo already configured in $GRADLE_FILE"
  exit 0
fi

# Add the maven repository inside allprojects > repositories
sed -i.bak '/allprojects {/,/repositories {/ {
  /repositories {/ a\
\        // Transistorsoft background geolocation native libs\
\        maven { url("${project('"'"':transistorsoft-capacitor-background-geolocation'"'"').projectDir}/libs") }
}' "$GRADLE_FILE"

# Remove backup file
rm -f "${GRADLE_FILE}.bak"

echo "✅ Added Transistorsoft Maven repo to $GRADLE_FILE"
