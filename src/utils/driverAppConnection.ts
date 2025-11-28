/**
 * Driver App Connection Module
 * Copy this entire file to your mobile app builder
 * 
 * Prerequisites:
 * - Install @supabase/supabase-js
 * - Install @capacitor/geolocation
 */

import { supabase } from '@/integrations/supabase/client';
import { Geolocation } from '@capacitor/geolocation';

let locationWatchId: string | null = null;
let connectedDeviceId: string | null = null;

/**
 * Connect driver to a device using connection code
 */
export async function connectDriver(connectionCode: string): Promise<{ success: boolean; message: string; deviceName?: string }> {
  try {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, message: 'Please log in first' };
    }

    console.log('Connecting driver with code:', connectionCode.trim().toUpperCase());

    // Call the connect-driver edge function
    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { 
        action: 'connect',
        code: connectionCode.trim().toUpperCase() 
      }
    });

    console.log('Connect response:', data, error);

    if (error) throw error;

    if (data?.success) {
      connectedDeviceId = data.device?.id;
      // Start location tracking automatically after connection
      await startLocationTracking();
      return { 
        success: true, 
        message: 'Connected successfully', 
        deviceName: data.device?.name 
      };
    } else {
      return { success: false, message: data?.error || 'Connection failed' };
    }
  } catch (error: any) {
    console.error('Connection error:', error);
    return { success: false, message: error.message || 'Failed to connect' };
  }
}

/**
 * Disconnect driver from current device
 */
export async function disconnectDriver(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }

    // Stop location tracking first
    await stopLocationTracking();

    // Call the disconnect function
    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { action: 'disconnect' }
    });

    if (error) throw error;

    connectedDeviceId = null;
    return { success: true, message: 'Disconnected successfully' };
  } catch (error: any) {
    console.error('Disconnect error:', error);
    return { success: false, message: error.message || 'Failed to disconnect' };
  }
}

/**
 * Get current connection status
 */
export async function getConnectionStatus(): Promise<{ 
  connected: boolean; 
  deviceName?: string;
  deviceId?: string;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { connected: false };
    }

    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { action: 'get-connection' }
    });

    if (error) throw error;

    if (data?.connected && data?.device) {
      connectedDeviceId = data.device.id;
      return {
        connected: true,
        deviceName: data.device.name,
        deviceId: data.device.id
      };
    }

    return { connected: false };
  } catch (error) {
    console.error('Status check error:', error);
    return { connected: false };
  }
}

/**
 * Start background location tracking
 */
export async function startLocationTracking(): Promise<{ success: boolean; message: string }> {
  try {
    // Check location permissions
    const permission = await Geolocation.checkPermissions();
    
    if (permission.location !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted') {
        return { success: false, message: 'Location permission denied' };
      }
    }

    // Get or verify connected device
    if (!connectedDeviceId) {
      const status = await getConnectionStatus();
      if (!status.connected || !status.deviceId) {
        return { success: false, message: 'No device connected' };
      }
      connectedDeviceId = status.deviceId;
    }

    // Stop existing watch if any
    if (locationWatchId) {
      await Geolocation.clearWatch({ id: locationWatchId });
    }

    // Start watching position
    locationWatchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      },
      (position, err) => {
        if (err) {
          console.error('Location error:', err);
          return;
        }

        if (position && connectedDeviceId) {
          // Send location to backend
          sendLocationUpdate(
            connectedDeviceId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.speed || 0
          ).catch(console.error);
        }
      }
    );

    return { success: true, message: 'Location tracking started' };
  } catch (error: any) {
    console.error('Tracking start error:', error);
    return { success: false, message: error.message || 'Failed to start tracking' };
  }
}

/**
 * Stop location tracking
 */
export async function stopLocationTracking(): Promise<void> {
  if (locationWatchId) {
    await Geolocation.clearWatch({ id: locationWatchId });
    locationWatchId = null;
  }
}

/**
 * Send location update to server
 */
async function sendLocationUpdate(
  deviceId: string,
  latitude: number,
  longitude: number,
  speed: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('locations')
      .insert({
        device_id: deviceId,
        latitude,
        longitude,
        speed,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    // Update device status to active
    await supabase
      .from('devices')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);

  } catch (error) {
    console.error('Location update error:', error);
  }
}

/**
 * Initialize driver app on startup
 * Call this when your app starts
 */
export async function initializeDriverApp(): Promise<void> {
  try {
    // Check if there's an existing connection
    const status = await getConnectionStatus();
    
    if (status.connected && status.deviceId) {
      connectedDeviceId = status.deviceId;
      // Restart location tracking if connected
      await startLocationTracking();
      console.log('Driver app initialized with device:', status.deviceName);
    } else {
      console.log('Driver app initialized - no active connection');
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Export the current device ID for external use
export function getConnectedDeviceId(): string | null {
  return connectedDeviceId;
}
