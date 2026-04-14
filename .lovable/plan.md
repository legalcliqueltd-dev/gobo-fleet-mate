

# Fix Continuous Offline Location Tracking (Android + iOS)

## Problem

Location tracking stops when the app is backgrounded or goes offline because:
- **Android**: `watchPosition` JS callbacks freeze when the WebView is suspended, despite the foreground service keeping the process alive. No native-level location persistence.
- **iOS**: Transistorsoft has native persistence but requires a license. The fallback path has zero background or offline capability.
- **Both**: `localStorage` queue is volatile (can be cleared by OS) and has no periodic retry — it only syncs on the browser `online` event or manual tap.

## Plan

### 1. Android: Replace watchPosition with polling via setInterval + getCurrentPosition

`watchPosition` callbacks freeze when Android suspends the WebView. Instead, use a `setInterval` loop calling `Geolocation.getCurrentPosition()` every 30s. The foreground service keeps the process alive, and `setInterval` is more resilient than watch callbacks.

**File**: `src/hooks/useBackgroundLocationTracking.ts`

### 2. Upgrade offline queue from localStorage to IndexedDB

IndexedDB is more resilient — handles larger datasets, isn't cleared as aggressively, and supports structured data.

**New file**: `src/utils/offlineLocationStore.ts`
- Simple IndexedDB wrapper: `addLocation()`, `getAllPending()`, `removeSynced()`, `count()`

**Update**: `src/hooks/useBackgroundLocationTracking.ts` and `src/components/OfflineQueue.tsx`
- Store failed/offline locations in IndexedDB instead of localStorage
- Read pending count from IndexedDB for display

### 3. Add periodic sync retry loop

**Update**: `src/hooks/useBackgroundLocationTracking.ts`
- 60-second `setInterval` checks IndexedDB for pending locations and batch-uploads via the existing `sync-trail` edge function action
- Runs independently of the unreliable `navigator.onLine` event

### 4. iOS fallback: add offline persistence to Capacitor Geolocation path

When Transistorsoft fails and the app falls back to `@capacitor/geolocation`:

**Update**: `src/hooks/useIOSBackgroundTracking.ts`
- When Transistorsoft fails, start a Capacitor `watchPosition` with IndexedDB persistence and the same periodic sync retry as Android

### 5. Update OfflineQueue UI

**Update**: `src/components/OfflineQueue.tsx`
- Show pending location count from IndexedDB
- Manual sync button triggers batch upload

## Files Changed

| File | Change |
|------|--------|
| `src/utils/offlineLocationStore.ts` | **New** — IndexedDB wrapper for offline locations |
| `src/hooks/useBackgroundLocationTracking.ts` | Polling instead of watchPosition on Android; IndexedDB storage; periodic sync retry |
| `src/hooks/useIOSBackgroundTracking.ts` | Capacitor fallback with IndexedDB offline persistence |
| `src/components/OfflineQueue.tsx` | Read location count from IndexedDB |

No database or edge function changes needed — the existing `sync-trail` action already handles batched uploads.

