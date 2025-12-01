# Rocket Driver App — Location Permission Gate

> **Goal:** Ensure drivers grant location permission before using the app. Without location consent, the app is unusable. This creates a mandatory onboarding gate that explains why location is needed and blocks access until permission is granted.

---

## 1) Overview & Requirements

### Core Requirement
The Rocket driver app MUST obtain location permission before allowing any app functionality. This is critical because:
- The entire purpose of the app is to track driver location for fleet management
- Admin dashboards rely on real-time GPS data to monitor drivers
- Without location data, the driver cannot appear on maps or receive location-based tasks

### User Flow
```
App Launch → Permission Check → 
  ├─ Permission GRANTED → Continue to Driver Dashboard
  └─ Permission DENIED/NOT_REQUESTED → Show Permission Gate (blocks all access)
```

---

## 2) Permission Gate Screen Specification

### Screen: `LocationPermissionGate`

**Purpose:** Full-screen blocking modal that explains why location is required and guides user to grant permission.

### Visual Design

```
┌─────────────────────────────────────────┐
│                                         │
│         [Location Pin Icon]             │
│           (large, animated)             │
│                                         │
│      "Location Access Required"         │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  To use the Rocket Driver App,  │   │
│   │  we need access to your         │   │
│   │  location. This allows:         │   │
│   │                                 │   │
│   │  ✓ Your admin to see your      │   │
│   │    live position on the map     │   │
│   │                                 │   │
│   │  ✓ Receive location-based      │   │
│   │    task assignments             │   │
│   │                                 │   │
│   │  ✓ Accurate trip tracking      │   │
│   │    and distance calculations    │   │
│   │                                 │   │
│   │  ✓ Emergency SOS features      │   │
│   │    to share your location       │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  🔒 Privacy Notice              │   │
│   │  Your location is only shared   │   │
│   │  with your fleet admin while    │   │
│   │  you're on duty. We never sell  │   │
│   │  or share your data with third  │   │
│   │  parties.                       │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │     [Enable Location Access]    │   │  ← Primary CTA (green)
│   └─────────────────────────────────┘   │
│                                         │
│   "By continuing, you agree to our"     │
│   "Terms of Service and Privacy Policy" │
│                                         │
└─────────────────────────────────────────┘
```

### States & Interactions

#### State 1: Initial (Permission Not Yet Requested)
- Show explanation screen with "Enable Location Access" button
- Tapping button triggers native permission dialog
- Button text: "Enable Location Access"

#### State 2: Permission Denied Once
- Show same screen with modified messaging
- Add helper text: "You previously denied location access"
- Button text: "Grant Location Permission"
- Add secondary link: "Open Settings" (for manual enable)

#### State 3: Permission Permanently Denied
- Show screen explaining how to enable in settings
- Primary button: "Open App Settings"
- Add step-by-step instructions:
  ```
  To enable location:
  1. Tap "Open App Settings" below
  2. Select "Permissions" or "Location"
  3. Choose "Allow all the time" or "While using app"
  4. Return to this app
  ```

#### State 4: Permission Granted
- Auto-dismiss gate screen
- Navigate to Driver Dashboard
- Show brief success toast: "Location enabled ✓"

---

## 3) Technical Implementation

### Required Capacitor Plugins
```bash
npm install @capacitor/geolocation
```

### Permission Types to Request

**Android:**
- `ACCESS_FINE_LOCATION` (precise GPS)
- `ACCESS_COARSE_LOCATION` (network-based)
- `ACCESS_BACKGROUND_LOCATION` (for tracking while app is minimized) — Optional but recommended

**iOS:**
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription` — For background tracking

### Core Logic Flow

```typescript
// Pseudocode for permission gate logic

async function checkLocationPermission(): Promise<PermissionState> {
  const status = await Geolocation.checkPermissions();
  return status.location; // 'granted' | 'denied' | 'prompt'
}

async function requestLocationPermission(): Promise<boolean> {
  const status = await Geolocation.requestPermissions();
  return status.location === 'granted';
}

function openAppSettings(): void {
  // Platform-specific: opens device settings for this app
  App.openUrl({ url: 'app-settings:' }); // iOS
  // or native intent for Android
}

// App wrapper component
function AppWithPermissionGate({ children }) {
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  
  useEffect(() => {
    checkLocationPermission().then(status => {
      setPermissionStatus(status);
    });
  }, []);
  
  // Listen for app resume (user might have changed settings)
  useEffect(() => {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkLocationPermission().then(setPermissionStatus);
      }
    });
  }, []);
  
  if (permissionStatus === 'checking') {
    return <LoadingScreen />;
  }
  
  if (permissionStatus !== 'granted') {
    return <LocationPermissionGate 
      status={permissionStatus}
      onRequestPermission={requestLocationPermission}
      onOpenSettings={openAppSettings}
    />;
  }
  
  return children; // Show actual app
}
```

### Background Location (Recommended)

For continuous tracking even when app is minimized:

```typescript
// Request background location (Android 10+, iOS)
async function requestBackgroundLocation() {
  // First, ensure foreground permission is granted
  const foreground = await Geolocation.requestPermissions();
  
  if (foreground.location === 'granted') {
    // On Android 10+, need separate background permission
    // Show explanation screen first, then request
    const background = await Geolocation.requestPermissions({
      permissions: ['location']
    });
    
    return background.location === 'granted';
  }
  
  return false;
}
```

---

## 4) Permission Gate Component Spec

### Props
```typescript
interface LocationPermissionGateProps {
  // Current permission status
  status: 'prompt' | 'denied' | 'denied-forever';
  
  // Callback when user taps main CTA
  onRequestPermission: () => Promise<boolean>;
  
  // Callback to open system settings
  onOpenSettings: () => void;
  
  // Optional: callback when permission is granted
  onPermissionGranted?: () => void;
  
  // Optional: custom privacy policy URL
  privacyPolicyUrl?: string;
  
  // Optional: custom terms of service URL
  termsUrl?: string;
}
```

### UI Components

```typescript
// Main gate component structure
<LocationPermissionGate>
  <Container fullScreen centered>
    <AnimatedLocationIcon />
    
    <Title>"Location Access Required"</Title>
    
    <BenefitsList>
      <BenefitItem icon="map" text="Live position tracking for your admin" />
      <BenefitItem icon="task" text="Receive location-based assignments" />
      <BenefitItem icon="route" text="Accurate trip and distance tracking" />
      <BenefitItem icon="sos" text="Emergency SOS location sharing" />
    </BenefitsList>
    
    <PrivacyNotice>
      <LockIcon />
      <Text>Your location is only shared with your fleet admin...</Text>
    </PrivacyNotice>
    
    {status === 'denied-forever' && (
      <SettingsInstructions>
        <Text>To enable location manually:</Text>
        <NumberedList>
          <Step>Tap "Open App Settings" below</Step>
          <Step>Select "Permissions" → "Location"</Step>
          <Step>Choose "Allow all the time"</Step>
          <Step>Return to Rocket app</Step>
        </NumberedList>
      </SettingsInstructions>
    )}
    
    <PrimaryButton 
      onPress={status === 'denied-forever' ? onOpenSettings : onRequestPermission}
    >
      {status === 'denied-forever' ? 'Open App Settings' : 'Enable Location Access'}
    </PrimaryButton>
    
    <LegalLinks>
      <Link to={termsUrl}>Terms of Service</Link>
      <Link to={privacyPolicyUrl}>Privacy Policy</Link>
    </LegalLinks>
  </Container>
</LocationPermissionGate>
```

---

## 5) Error Handling & Edge Cases

### Case: User Denies Permission
- Don't show error message immediately
- Re-show the gate with updated messaging
- Track denial count in local storage
- After 2 denials, show "Open Settings" option prominently

### Case: Location Services Disabled (Device-Level)
- Detect when GPS is off entirely
- Show different message: "Please enable Location Services in your device settings"
- Provide button to open device location settings (not app settings)

### Case: Poor GPS Signal
- This is handled separately in the location tracking logic
- Permission gate only concerns permission, not signal quality
- Show a "Searching for GPS..." indicator after permission is granted

### Case: Permission Revoked While App Running
- Listen for permission changes
- If revoked mid-session, immediately show gate again
- Save any pending data before blocking

---

## 6) Analytics Events to Track

```typescript
// Track user journey through permission gate
analytics.track('location_permission_gate_shown', {
  status: 'prompt' | 'denied' | 'denied-forever',
  showCount: number
});

analytics.track('location_permission_requested', {
  previousStatus: string
});

analytics.track('location_permission_result', {
  granted: boolean,
  attemptNumber: number
});

analytics.track('location_settings_opened', {
  fromGate: true
});

analytics.track('location_permission_granted', {
  method: 'direct' | 'from-settings',
  totalAttempts: number
});
```

---

## 7) Copy/Messaging Guidelines

### Tone
- Friendly but firm
- Explain the "why" clearly
- Emphasize privacy protection
- Avoid technical jargon

### Key Messages

**Title Options:**
- "Location Access Required"
- "We Need Your Location"
- "Enable Location to Continue"

**Explanation Copy:**
> "To use the Rocket Driver App, we need access to your location. This allows your fleet admin to see where you are and assign you tasks efficiently."

**Privacy Reassurance:**
> "🔒 Your location is only shared with your fleet admin while you're on duty. We never sell or share your location data with third parties."

**Permission Denied Copy:**
> "Location access is required to use this app. Without it, we can't show your position to your admin or assign you location-based tasks."

**Settings Instructions Copy:**
> "It looks like location permission was denied. You can enable it manually in your device settings."

---

## 8) Testing Checklist

- [ ] Fresh install shows permission gate before any app content
- [ ] Granting permission immediately dismisses gate
- [ ] Denying permission keeps gate visible
- [ ] "Open Settings" correctly opens app permission settings
- [ ] Returning from settings with permission granted auto-dismisses gate
- [ ] Permission revoked mid-session re-shows gate
- [ ] Works on Android 10, 11, 12, 13, 14
- [ ] Works on iOS 14, 15, 16, 17
- [ ] Background location request shows separate dialog (Android 10+)
- [ ] Gate prevents access to all screens (not just dashboard)

---

## 9) Implementation Priority

1. **P0 (Must Have):**
   - Basic permission check on app launch
   - Blocking gate screen
   - Request permission flow
   - Open settings fallback

2. **P1 (Should Have):**
   - Background location request
   - Re-check on app resume
   - Animated UI elements
   - Analytics tracking

3. **P2 (Nice to Have):**
   - Step-by-step settings instructions with screenshots
   - Video tutorial for enabling location
   - Multi-language support for gate copy

---

## 10) Sample Implementation Request for Rocket

**Prompt to implement this feature:**

> Implement a mandatory location permission gate for the Rocket driver app. The gate should:
>
> 1. Check location permission status on every app launch
> 2. Block ALL app access until permission is granted (show full-screen gate)
> 3. Display clear explanation of why location is needed (fleet tracking, task assignment, trip logging, SOS)
> 4. Include privacy reassurance about data usage
> 5. Handle three states: prompt (first time), denied (show "try again"), denied-forever (show "open settings")
> 6. Auto-detect when user returns from settings with permission granted
> 7. Request background location for continuous tracking when app is minimized
> 8. Use Capacitor Geolocation plugin for cross-platform support
> 9. Wrap the entire app router so no screen is accessible without permission
> 10. Show success toast when permission is granted
>
> The UI should be clean, mobile-friendly, and use the app's existing design system. Include the permission gate as a wrapper component around the main app routes.
