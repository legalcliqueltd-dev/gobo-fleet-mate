
# Fix: Google Maps Loader Conflict Causing Blank Navigation Screen

## Problem Identified

The error `"Loader must not be called again with different options"` occurs because the Google Maps JavaScript API is being initialized with **two different loader IDs**:

| Component | Loader ID |
|-----------|-----------|
| `TaskNavigationMap.tsx` | *(none - defaults to "script-loader")* |
| All other map components | `'google-map-script'` |

When a driver opens the navigation map after any other map component has already loaded the API, it crashes because the loader detects a conflict.

## Solution

Add the consistent `id: 'google-map-script'` to the `useJsApiLoader` call in `TaskNavigationMap.tsx` to match all other map components.

## Technical Change

**File:** `src/components/map/TaskNavigationMap.tsx`

**Current Code (line 25-27):**
```typescript
const { isLoaded } = useJsApiLoader({
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
});
```

**Fixed Code:**
```typescript
const { isLoaded } = useJsApiLoader({
  id: 'google-map-script',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
});
```

## Why This Works

The `@react-google-maps/api` library uses the `id` parameter to track whether the API script has already been loaded. When all components use the same ID (`google-map-script`), the loader:
- Returns the existing loaded instance if it's already available
- Only loads once across the entire application
- Never throws the "different options" error

## After Implementation

1. Git pull the fix
2. Run `npx cap sync ios`
3. Rebuild in Xcode
4. Test by opening a task and tapping "Navigate"

The navigation map should now display the route without a blank screen or JavaScript error.
