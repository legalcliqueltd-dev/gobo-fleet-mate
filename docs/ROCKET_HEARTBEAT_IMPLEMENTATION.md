# Rocket Driver App - Heartbeat & Location Implementation

## Problem
The driver shows as "active" only during login, then becomes "offline" because the app stops sending updates.

## Solution
The mobile app MUST continuously send location/heartbeat updates while the driver is online.

---

## Required API Calls

### 1. Location Update (Every 10-30 seconds)
Call this endpoint whenever you get a new GPS position:

```javascript
const sendLocationUpdate = async (driverId, latitude, longitude, speed, accuracy) => {
  const response = await fetch('https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update-location',
      driverId: driverId,
      latitude: latitude,
      longitude: longitude,
      speed: speed || 0,
      accuracy: accuracy || 0
    })
  });
  
  return response.json();
};
```

### 2. Status Update (Heartbeat - Every 30-60 seconds)
Call this as a fallback when GPS isn't available or as a heartbeat:

```javascript
const sendHeartbeat = async (driverId) => {
  const response = await fetch('https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update-status',
      driverId: driverId,
      status: 'active'
    })
  });
  
  return response.json();
};
```

---

## Implementation Pattern

```javascript
class DriverTracker {
  constructor(driverId) {
    this.driverId = driverId;
    this.locationWatchId = null;
    this.heartbeatInterval = null;
  }

  async start() {
    // Start GPS tracking
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        this.sendLocationUpdate(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.speed,
          position.coords.accuracy
        );
      },
      (error) => {
        console.error('GPS Error:', error);
        // Send heartbeat if GPS fails
        this.sendHeartbeat();
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000
      }
    );

    // Start heartbeat timer (backup in case GPS updates stop)
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds
  }

  async stop() {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Notify server driver is going offline
    await fetch('https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'disconnect',
        driverId: this.driverId
      })
    });
  }

  async sendLocationUpdate(lat, lng, speed, accuracy) {
    try {
      await fetch('https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-location',
          driverId: this.driverId,
          latitude: lat,
          longitude: lng,
          speed: speed || 0,
          accuracy: accuracy || 0
        })
      });
    } catch (error) {
      console.error('Location update failed:', error);
    }
  }

  async sendHeartbeat() {
    try {
      await fetch('https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-status',
          driverId: this.driverId,
          status: 'active'
        })
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }
}
```

---

## Usage in Rocket App

After successful login/connection:

```javascript
// Store driver ID from connection response
const driverId = connectionResponse.driver.driver_id;

// Create and start tracker
const tracker = new DriverTracker(driverId);
tracker.start();

// When app goes to background or user logs out
tracker.stop();
```

---

## Key Points

1. **Location updates** keep the driver visible on the map
2. **Heartbeat** keeps the driver status as "active" even without GPS
3. **Without these updates**, driver shows as "offline" after 5 minutes
4. **Always call disconnect** when the driver logs out or closes the app

---

## Status Thresholds (Admin Dashboard)

| Time Since Last Update | Status Shown |
|------------------------|--------------|
| < 2 minutes            | Active       |
| 2-5 minutes            | Idle         |
| > 5 minutes            | Offline      |

**This is why Duye shows offline - no updates have been sent for 2+ hours!**
