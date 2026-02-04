
# Fix Capacitor iOS Build Error: Double-Quoted Includes

## Problem

Xcode is failing to build the CapacitorCordova framework due to strict module verification. The error messages indicate that header files are using double quotes for imports when they should use angle brackets:

```
error: double-quoted include "CDVInvokedUrlCommand.h" in framework header, 
       expected angle-bracketed instead
```

This is a **known compatibility issue** between Capacitor 7.x and Xcode 16+ with stricter module verification.

---

## Solution Options

### Option A: Clean Rebuild (Try First - Quickest)

Run these commands in your terminal to completely clean and rebuild:

```bash
# Navigate to project
cd /Users/iangobo/Documents/gobo-fleet-mate

# Remove iOS platform completely
rm -rf ios

# Clean node_modules Capacitor packages
rm -rf node_modules/@capacitor

# Reinstall dependencies
npm install

# Re-add iOS platform fresh
npx cap add ios

# Sync
npx cap sync ios

# Open Xcode
npx cap open ios
```

In Xcode:
1. **Product → Clean Build Folder** (⇧⌘K)
2. **Delete DerivedData**: `rm -rf ~/Library/Developer/Xcode/DerivedData/App-*`
3. Build again (⌘B)

---

### Option B: Disable Strict Module Verification (If Option A Fails)

Add a post-install hook to the Podfile to disable the strict check:

**File: `ios/App/Podfile`**

Add this at the bottom of the Podfile, before the final `end`:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Disable strict module verification that causes double-quote errors
      config.build_settings['OTHER_SWIFT_FLAGS'] ||= ['$(inherited)']
      config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
    end
  end
end
```

Then run:
```bash
cd ios/App
pod install
cd ../..
npx cap open ios
```

---

### Option C: Switch to Swift Package Manager (Most Robust Long-Term Fix)

Capacitor 7 supports SPM natively. This avoids CocoaPods entirely and resolves the header issue.

1. Remove the Pods directory and Podfile
2. Open Xcode and add Capacitor packages via SPM
3. This requires more manual setup but is the cleanest solution

---

## Recommended Approach

1. **Try Option A first** - A clean rebuild often resolves cached/stale build issues
2. **If that fails, use Option B** - The Podfile post-install hook is a reliable workaround
3. **Option C is for advanced users** who want to eliminate CocoaPods entirely

---

## Technical Details

**Why This Happens:**
- Xcode 16 introduced stricter verification for Clang module headers
- CapacitorCordova's headers use `#import "CDVPlugin.h"` (double quotes)
- The verifier expects `#import <CapacitorCordova/CDVPlugin.h>` (angle brackets)
- This is a Capacitor upstream issue that affects builds from `node_modules`

**Files Affected (in node_modules - read only):**
- `CDVCommandDelegate.h`
- `CDVCommandDelegateImpl.h`
- `CDVPlugin+Resources.h`
- `CDVPluginManager.h`
- `CDVURLProtocol.h`

**The Warning About XCFrameworks:**
The warnings about `[CP] Copy XCFrameworks` are non-blocking and can be ignored for now - they don't prevent the build from succeeding once the import errors are fixed.
