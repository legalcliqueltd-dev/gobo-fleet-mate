
## Remove duplicate sync panel on driver dashboard

Two sync/queue UIs render on `DriverAppDashboard.tsx`:

- **On the map** (top, overlay): `<OfflineQueue />` — the "Sync Queue" card with native + mirror counts.
- **Bottom card area**: `<DebugStatusPanel />` — collapsible debug panel showing native SQLite count, IndexedDB mirror count, last successful sync, and tracking state.

The user wants the map overlay removed and only the bottom panel kept.

### Change

`src/pages/app/DriverAppDashboard.tsx`:
- Delete the floating `OfflineQueue` block (lines 407–410):
  ```tsx
  <div className="absolute top-20 left-0 right-0 z-10 pointer-events-auto">
    <OfflineQueue />
  </div>
  ```
- Remove the now-unused `import OfflineQueue from '@/components/OfflineQueue';` (line 19).
- Keep `<DebugStatusPanel />` in the bottom card area as-is.

### Notes

- `OfflineQueue.tsx` itself stays in the codebase — it is still used elsewhere (and contains the `queueOfflineAction` helper exported for non-location queueing). Only the dashboard's render of it is removed.
- `DebugStatusPanel` already exposes the same key info (pending count, last sync, tracking state) plus the native SQLite count, so no functionality is lost.
- No other files affected.

### Verification
- Open the driver app dashboard on iPhone — only one sync indicator visible (the collapsible debug panel at the bottom). The floating "Sync Queue" card on top of the map is gone.
- Tap the bottom panel to expand — native SQLite count, mirror count, last sync time, and tracking state still shown.
