# Rocket App Integration Guide

## Overview
This guide provides everything needed to integrate the Rocket driver app with your admin dashboard.

---

## 1. Supabase Configuration

### Project Details
```
Project ID: invbnyxieoyohahqhbir
Supabase URL: https://invbnyxieoyohahqhbir.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI
```

### Environment Variables for Rocket App
```env
SUPABASE_URL=https://invbnyxieoyohahqhbir.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI
```

---

## 2. Authentication Flow

### Step 1: Driver Signup/Login
Drivers must first create an account using Supabase Auth:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://invbnyxieoyohahqhbir.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI'
);

// Sign up
async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName,
        role: 'driver'
      }
    }
  });
  
  if (error) {
    console.error('Signup error:', error.message);
    return { success: false, error: error.message };
  }
  
  return { success: true, user: data.user };
}

// Sign in
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
  
  if (error) {
    console.error('Login error:', error.message);
    return { success: false, error: error.message };
  }
  
  return { success: true, session: data.session, user: data.user };
}
```

### Step 2: Connect Using Connection Code

After login, driver enters the connection code provided by the admin:

```javascript
async function connectToAdmin(connectionCode) {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }
  
  // Call the connect-driver edge function
  const { data, error } = await supabase.functions.invoke('connect-driver', {
    body: {
      action: 'connect',
      code: connectionCode.toUpperCase().trim()
    }
  });
  
  if (error) {
    console.error('Connection error:', error);
    return { success: false, error: error.message };
  }
  
  if (data.error) {
    return { success: false, error: data.error };
  }
  
  return {
    success: true,
    device: data.device
  };
}
```

### Step 3: Check Connection Status

```javascript
async function getConnectionStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { connected: false };
  }
  
  const { data, error } = await supabase.functions.invoke('connect-driver', {
    body: { action: 'get-connection' }
  });
  
  if (error || data.error) {
    return { connected: false };
  }
  
  return {
    connected: data.connected,
    device: data.device
  };
}
```

### Step 4: Send Location Updates

Once connected, send location updates:

```javascript
async function sendLocationUpdate(latitude, longitude, speed) {
  // Get the connected device
  const status = await getConnectionStatus();
  
  if (!status.connected || !status.device) {
    console.error('Not connected to any device');
    return { success: false, error: 'Not connected' };
  }
  
  // Insert location
  const { error } = await supabase
    .from('locations')
    .insert({
      device_id: status.device.id,
      latitude: latitude,
      longitude: longitude,
      speed: speed,
      timestamp: new Date().toISOString()
    });
  
  if (error) {
    console.error('Location update error:', error);
    return { success: false, error: error.message };
  }
  
  // Update device status
  await supabase
    .from('devices')
    .update({
      status: speed > 5 ? 'active' : 'idle',
      updated_at: new Date().toISOString()
    })
    .eq('id', status.device.id);
  
  return { success: true };
}
```

### Step 5: Background Location Tracking

For continuous tracking:

```javascript
let locationWatchId = null;

async function startLocationTracking() {
  const status = await getConnectionStatus();
  
  if (!status.connected) {
    return { success: false, error: 'Not connected to admin' };
  }
  
  // Request location permissions
  if (!navigator.geolocation) {
    return { success: false, error: 'Geolocation not supported' };
  }
  
  locationWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const speed = position.coords.speed || 0;
      
      await sendLocationUpdate(latitude, longitude, speed * 3.6); // Convert m/s to km/h
    },
    (error) => {
      console.error('Geolocation error:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
  
  return { success: true };
}

function stopLocationTracking() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}
```

### Step 6: Disconnect from Admin

```javascript
async function disconnectFromAdmin() {
  const { data, error } = await supabase.functions.invoke('connect-driver', {
    body: { action: 'disconnect' }
  });
  
  if (error || data.error) {
    return { success: false, error: error?.message || data.error };
  }
  
  return { success: true };
}
```

---

## 3. Edge Function Endpoints

### Connect Driver Function
**Endpoint:** `https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver`

**Actions:**
- `connect` - Connect to admin using code
- `disconnect` - Disconnect from current admin
- `get-connection` - Get current connection status

**Authentication:** Required (Bearer token in Authorization header)

---

## 4. Database Schema

### Tables Used by Rocket App

#### `devices`
- Stores device information and connection codes
- Drivers connect to devices using the connection_code

#### `locations`
- Stores location history
- Driver app inserts location updates here

#### `driver_connections`
- Tracks driver-admin relationships
- Managed automatically by the connect-driver function

---

## 5. Row Level Security (RLS)

### Important Security Notes

✅ **SECURE**: The `devices` table has proper RLS policies
- Drivers can only read/write devices they're connected to
- Admins can manage their own devices

✅ **SECURE**: The `locations` table has proper RLS policies
- Drivers can only insert locations for connected devices
- Admins can read locations for their devices

✅ **FIXED**: The critical security vulnerability in `driver_connections` has been resolved

---

## 6. Auth Redirect URLs

Add these URLs in Supabase → Authentication → URL Configuration:

### Development
```
http://localhost:3000
http://localhost:4000
http://localhost:8080
http://127.0.0.1:3000
```

### Production
```
https://invbnyxieoyohahqhbir.supabase.co
[Your deployed admin domain]
[Your deployed Rocket app domain]
rocket://callback
```

---

## 7. Testing Checklist

### Admin Side
1. ✅ Create device → Connection code generated
2. ✅ Connection code visible in device details
3. ✅ Can copy connection code to clipboard

### Rocket Side
1. ✅ Driver signs up with email/password
2. ✅ Driver logs in successfully
3. ✅ Driver enters connection code
4. ✅ Connection established (device.connected_driver_id updated)
5. ✅ Location updates sent successfully
6. ✅ Admin sees driver location in real-time
7. ✅ Driver can disconnect

---

## 8. Error Handling

### Common Errors & Solutions

**Error: "Invalid connection code"**
- Check the code is correct (case-insensitive)
- Verify the device exists in the database
- Ensure the code hasn't been deleted

**Error: "Device is already connected to another driver"**
- The device is already in use by another driver
- Admin must disconnect the other driver first
- Or driver must use a different connection code

**Error: "Not authenticated"**
- Driver must log in first before connecting
- Check the session token is valid
- Verify the Authorization header is set

**Error: "Failed to connect to device"**
- Check RLS policies on the devices table
- Verify the driver has the correct role
- Check edge function logs for details

---

## 9. Connection Code Format

Connection codes are:
- **8 characters long**
- **Alphanumeric** (A-Z, 0-9)
- **Case-insensitive**
- **Unique** per device

Examples: `BA2BD021`, `004A966C`

---

## 10. Complete Integration Code for Rocket App

```javascript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://invbnyxieoyohahqhbir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const RocketDriverAPI = {
  // Authentication
  async signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'driver' }
      }
    });
    return { success: !error, data, error };
  },
  
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { success: !error, data, error };
  },
  
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { success: !error, error };
  },
  
  // Connection Management
  async connect(connectionCode) {
    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { action: 'connect', code: connectionCode.toUpperCase().trim() }
    });
    
    if (error) return { success: false, error: error.message };
    if (data.error) return { success: false, error: data.error };
    
    return { success: true, device: data.device };
  },
  
  async disconnect() {
    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { action: 'disconnect' }
    });
    
    if (error) return { success: false, error: error.message };
    if (data.error) return { success: false, error: data.error };
    
    return { success: true };
  },
  
  async getConnectionStatus() {
    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { action: 'get-connection' }
    });
    
    if (error) return { connected: false, error: error.message };
    if (data.error) return { connected: false, error: data.error };
    
    return { connected: data.connected, device: data.device };
  },
  
  // Location Updates
  async sendLocation(latitude, longitude, speed) {
    const status = await this.getConnectionStatus();
    
    if (!status.connected || !status.device) {
      return { success: false, error: 'Not connected to admin' };
    }
    
    const { error } = await supabase
      .from('locations')
      .insert({
        device_id: status.device.id,
        latitude,
        longitude,
        speed,
        timestamp: new Date().toISOString()
      });
    
    if (error) return { success: false, error: error.message };
    
    // Update device status
    await supabase
      .from('devices')
      .update({
        status: speed > 5 ? 'active' : 'idle',
        updated_at: new Date().toISOString()
      })
      .eq('id', status.device.id);
    
    return { success: true };
  }
};
```

---

## 11. Support & Troubleshooting

For issues:
1. Check edge function logs: [Function Logs](https://supabase.com/dashboard/project/invbnyxieoyohahqhbir/functions/connect-driver/logs)
2. Verify RLS policies in Supabase dashboard
3. Check authentication state in Rocket app
4. Verify connection codes match in database
