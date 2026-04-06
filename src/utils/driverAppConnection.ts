/**
 * Driver App Connection Module
 * 
 * Prerequisites:
 * - Install @supabase/supabase-js
 * - Install @capacitor/geolocation
 * - Install @capacitor/core
 */

import { supabase } from '@/integrations/supabase/client';
import { Geolocation } from '@capacitor/geolocation';
import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable } from '@/utils/nativeGeolocation';

let locationWatchId: string | number | null = null;
let connectedDeviceId: string | null = null;

export async function connectDriver(connectionCode: string): Promise<{ success: boolean; message: string; deviceName?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, message: 'Please log in first' };
    }

    console.log('Connecting driver with code:', connectionCode.trim().toUpperCase());

    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: { action: 'connect', code: connectionCode.trim().toUpperCase() }
    });

    console.log('Connect response:', data, error);

    if (error) throw error;

    if (data?.success) {
      connectedDeviceId = data.device?.id;
      await startLocationTracking();
      return { success: true, message: 'Connected successfully', deviceName: data.device?.name };
    } else {
      return { success: false, message: data?.error || 'Connection failed' };
    }
  } catch (error: any) {
    console.error('Connection error:', error);
    return { success: false, message: error.message || 'Failed to connect' };
  }
}

export async function disconnectDriver(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, message: 'Not authenticated' };
    }

    await stopLocationTracking();

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
      return { connected: true, deviceName: data.device.name, deviceId: data.device.id };
    }

    return { connected: false };
  } catch (error) {
    console.error('Status check error:', error);
    return { connected: false };
  }
}

const isNative = detectNativePlatform();
const isNativeAndroid = isNative && isAndroid();
const useNativePlugin = isNative && isGeolocationPluginAvailable();

export async function startLocationTracking(): Promise<{ success: boolean; message: string }> {
  try {
    if (!connectedDeviceId) {
      const status = await getConnectionStatus();
      if (!status.connected || !status.deviceId) {
        return { success: false, message: 'No device connected' };
      }
      connectedDeviceId = status.deviceId;
    }

    await stopLocationTracking();

    if (useNativePlugin) {
      // Native (Android or iOS) — use Capacitor exclusively
      const permission = await Geolocation.checkPermissions();

      if (permission.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted') {
          return { success: false, message: 'Location permission denied' };
        }
      }

      locationWatchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        (position, err) => {
          if (err) {
            console.error('Location error:', err);
            return;
          }
          if (position && connectedDeviceId) {
            sendLocationUpdate(
              connectedDeviceId,
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed || 0
            ).catch(console.error);
          }
        }
      );
    } else if (!isNativeAndroid) {
      // Web/PWA only — browser geolocation is acceptable
      if (!navigator.geolocation) {
        return { success: false, message: 'Geolocation not supported' };
      }

      locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          if (connectedDeviceId) {
            sendLocationUpdate(
              connectedDeviceId,
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed || 0
            ).catch(console.error);
          }
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      // Native Android but plugin unavailable — configuration error
      console.error('[driverAppConnection] Native Android but Geolocation plugin unavailable.');
      return { success: false, message: 'Location plugin unavailable. Reinstall the app.' };
    }

    return { success: true, message: 'Location tracking started' };
  } catch (error: any) {
    console.error('Tracking start error:', error);
    return { success: false, message: error.message || 'Failed to start tracking' };
  }
}

export async function stopLocationTracking(): Promise<void> {
  if (locationWatchId !== null) {
    if (useNativePlugin) {
      await Geolocation.clearWatch({ id: locationWatchId as string });
    } else {
      navigator.geolocation.clearWatch(locationWatchId as number);
    }
    locationWatchId = null;
  }
}

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

    await supabase
      .from('devices')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', deviceId);
  } catch (error) {
    console.error('Location update error:', error);
  }
}

export async function initializeDriverApp(): Promise<void> {
  try {
    const status = await getConnectionStatus();
    if (status.connected && status.deviceId) {
      connectedDeviceId = status.deviceId;
      await startLocationTracking();
      console.log('Driver app initialized with device:', status.deviceName);
    } else {
      console.log('Driver app initialized - no active connection');
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

export function getConnectedDeviceId(): string | null {
  return connectedDeviceId;
}
