

## Fix Capacitor Version Mismatch for iOS Build

### The Problem
Your project has a version conflict in the Capacitor packages:
- `@capacitor/core` is set to version 8.x
- All other Capacitor packages (`android`, `cli`, `geolocation`) are on version 7.x
- `@capacitor/ios` (which you need) requires `@capacitor/core` version 7.x

This mismatch is preventing you from installing the iOS package.

### The Solution
I'll align all Capacitor packages to version 7.4.4, and add the missing `@capacitor/ios` package.

### Changes Required

**1. Update package.json**

Change these dependencies:
```text
Before:
  "@capacitor/core": "^8.0.2"

After:
  "@capacitor/core": "^7.4.4",
  "@capacitor/ios": "^7.4.4"
```

### After I Make This Change

Once approved, you'll need to run these commands locally:

```bash
# Pull the updated package.json
git pull origin main

# Clean install to get aligned versions
rm -rf node_modules package-lock.json
npm install

# Now sync iOS should work
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### Technical Details
- Capacitor 7 uses Swift Package Manager (SPM) for iOS plugin management
- All Capacitor packages must be on the same major version to work together
- This change standardizes on v7.4.4 across the board

