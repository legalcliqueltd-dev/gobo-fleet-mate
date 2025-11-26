# Rocket App - Quick Start Guide

## 🚀 Essential Information

### Supabase Connection
```javascript
const SUPABASE_URL = 'https://invbnyxieoyohahqhbir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI';
```

### Edge Function URL
```
https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver
```

---

## 📝 Basic Flow

1. **Sign Up/Login** → Get auth token
2. **Connect** → Use 8-character connection code (e.g., `BA2BD021`)
3. **Send Locations** → Insert to `locations` table
4. **Done** → Admin sees location in real-time

---

## ✅ What Was Fixed

### Critical Security Issue ✅ FIXED
- **Before**: `driver_connections` table exposed ALL connection codes publicly
- **After**: Secure RLS policies - only authenticated queries work
- **Impact**: No more unauthorized access to connection codes

### Configuration ✅ VERIFIED
- ✅ Supabase URL: `https://invbnyxieoyohahqhbir.supabase.co`
- ✅ Anon Key: Correctly configured
- ✅ Project ID: `invbnyxieoyohahqhbir`
- ✅ Edge functions: Deployed and configured
- ✅ RLS Policies: Secure and working

### Code Generation ✅ VERIFIED
- ✅ Table: `devices`
- ✅ Column: `connection_code`
- ✅ Function: `generate_connection_code()` RPC
- ✅ Format: 8 uppercase alphanumeric characters
- ✅ Uniqueness: Enforced by generation loop

---

## 🔐 Authentication Required URLs

Add these to Supabase → Authentication → URL Configuration:

```
# Development
http://localhost:3000
http://localhost:4000

# Production
https://invbnyxieoyohahqhbir.supabase.co
[Your admin domain]
[Your Rocket app domain]
rocket://callback
```

---

## 📋 Minimal Rocket Integration

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://invbnyxieoyohahqhbir.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI'
);

// 1. Login
const { data } = await supabase.auth.signInWithPassword({
  email: 'driver@example.com',
  password: 'password123'
});

// 2. Connect with code
const { data: result } = await supabase.functions.invoke('connect-driver', {
  body: { action: 'connect', code: 'BA2BD021' }
});

// 3. Get device ID
const { data: status } = await supabase.functions.invoke('connect-driver', {
  body: { action: 'get-connection' }
});
const deviceId = status.device.id;

// 4. Send location
await supabase.from('locations').insert({
  device_id: deviceId,
  latitude: 37.7749,
  longitude: -122.4194,
  speed: 45,
  timestamp: new Date().toISOString()
});
```

---

## 🔍 Testing Verification

### Test Connection Code
Use one of these existing codes from your database:
- `004A966C` (device: "test users")
- `BA2BD021` (device: "Duye")

### Expected Results
✅ Connection succeeds → Returns `{ success: true, device: { id, name } }`
✅ Location inserted → Appears in admin dashboard map
✅ Device status updated → Shows "active" or "idle"

---

## 🚨 Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Authorization required" | No auth token | Call `signInWithPassword` first |
| "Invalid connection code" | Wrong code | Verify code in admin dashboard |
| "Device already connected" | Code in use | Admin must disconnect first |
| "Not connected to admin" | No active connection | Call `connect` action first |

---

## 📊 Database Tables

```
devices
├── id (uuid)
├── connection_code (text) ← Admin shares this
├── connected_driver_id (uuid) ← Set when driver connects
└── user_id (uuid) ← Admin's user ID

locations
├── device_id (uuid) ← From connection status
├── latitude (number)
├── longitude (number)
├── speed (number)
└── timestamp (timestamp)
```

---

## ✨ What Rocket Must Do

1. **Install**: `@supabase/supabase-js`
2. **Initialize**: Create Supabase client with URL + Key
3. **Authenticate**: Driver logs in with email/password
4. **Connect**: Call edge function with connection code
5. **Track**: Send location updates every 5-30 seconds
6. **Persist**: Store session token for automatic reconnection

See `docs/ROCKET_APP_INTEGRATION.md` for complete code examples.
