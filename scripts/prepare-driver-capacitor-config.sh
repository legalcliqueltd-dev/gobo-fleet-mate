#!/bin/bash

set -euo pipefail

SOURCE_CONFIG="capacitor.config.driver.ts"
TARGET_CONFIG="capacitor.config.ts"

if [ ! -f "$SOURCE_CONFIG" ]; then
  echo "❌ Missing $SOURCE_CONFIG"
  exit 1
fi

cp "$SOURCE_CONFIG" "$TARGET_CONFIG"
echo "✓ Driver Capacitor config copied to $TARGET_CONFIG"