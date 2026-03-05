

## Downgrade Scenario Analysis & Plan

### Current State

Right now, the device limit is only enforced at **creation time** in `AddDevice.tsx`. There is no enforcement on existing devices after a downgrade. This means:

- A Pro user with 6 devices who downgrades to Basic keeps all 6 devices active
- They just can't create new ones (already handled)
- But all 6 drivers continue working with no restriction

### The Problem

When a user downgrades from Pro to Basic, they have more devices than the Basic limit (2). The system needs to:
1. Prevent creating new devices (already done)
2. Let the admin **choose** which devices to keep active
3. Disable/pause the excess devices so only 2 remain functional

### Proposed Solution

**1. Add a "Device Over-Limit" banner on the Dashboard**

When `deviceCount > deviceLimit`, show a persistent warning banner:
> "Your Basic plan allows 2 devices. You have 6 active. Please deactivate 4 devices or upgrade to Pro."

This banner blocks access to the map/tracking features until the user resolves the over-limit state (soft block, not hard delete).

**2. Add enable/disable toggle per device on Dashboard**

Each device card gets a toggle or "Deactivate" button. The admin picks which devices to keep. Deactivated devices:
- Stop receiving location updates (driver app checks device status)
- Show as "paused" in the device list
- Are NOT deleted (data preserved)
- Can be reactivated if the user upgrades back to Pro

**3. Enforce limit in the `connect-driver` edge function**

When a driver tries to connect using a code belonging to a deactivated device, the connection is rejected with a message: "This device has been paused by your admin."

**4. Dashboard gate logic**

Add a check in Dashboard: if `deviceCount > deviceLimit`, overlay the main content with a "Manage Devices" prompt that forces the admin to deactivate excess devices before proceeding.

### Technical Changes

| File | Change |
|------|--------|
| **DB Migration** | Add `is_paused` boolean column to `devices` table (default `false`) |
| `src/pages/Dashboard.tsx` | Add over-limit banner with device count vs limit; add pause/unpause button per device card |
| `src/pages/devices/AddDevice.tsx` | Already handles creation block (no change) |
| `supabase/functions/connect-driver/index.ts` | Check `is_paused` on the device before allowing connection |
| `src/hooks/useDriverLocations.ts` | Filter out paused devices from active tracking |
| `src/components/PaymentWall.tsx` | No change needed |

### User Flow After Downgrade

```text
Pro (6 devices) → Downgrades to Basic (limit: 2)
         │
         ▼
Dashboard shows: "⚠ You have 6 devices but your plan allows 2.
                  Please pause 4 devices to continue."
         │
         ▼
Admin clicks "Pause" on 4 devices they don't need
         │
         ▼
Only 2 devices remain active, dashboard unlocks fully
Paused devices show greyed out with "Resume" option
         │
         ▼
If admin upgrades back to Pro → can resume all devices
```

### Alternative Considered

Hard-deleting excess devices was considered but rejected because it destroys historical data. Pausing is reversible and preserves trip/location history.

