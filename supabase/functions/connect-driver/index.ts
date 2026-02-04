import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate a unique driver ID
function generateDriverId(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  console.log('=== CONNECT-DRIVER FUNCTION INVOKED ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const body = await req.json();
    const { action, code, driverName, driverId } = body;
    console.log('Action:', action, 'Code:', code, 'DriverName:', driverName, 'DriverId:', driverId);

    // Always include server_time in responses for clock sync
    const serverTime = new Date().toISOString();

    // === INPUT VALIDATION HELPERS ===
    const validateConnectionCode = (codeInput: string | undefined): string | null => {
      if (!codeInput?.trim()) return 'Connection code is required';
      const trimmed = codeInput.trim().toUpperCase();
      if (trimmed.length !== 8) return 'Connection code must be 8 characters';
      if (!/^[A-Z0-9]+$/.test(trimmed)) return 'Connection code must be alphanumeric';
      return null;
    };

    const validateDriverName = (name: string | undefined): string | null => {
      if (!name?.trim()) return 'Driver name is required';
      if (name.trim().length > 100) return 'Driver name must be 100 characters or less';
      return null;
    };

    const validateLatitude = (lat: number | undefined): boolean => {
      return lat !== undefined && lat >= -90 && lat <= 90;
    };

    const validateLongitude = (lng: number | undefined): boolean => {
      return lng !== undefined && lng >= -180 && lng <= 180;
    };

    const validateBatteryLevel = (level: number | undefined): boolean => {
      return level === undefined || (level >= 0 && level <= 100);
    };

    const validateSpeed = (speed: number | undefined): boolean => {
      return speed === undefined || (speed >= 0 && speed <= 500);
    };

    if (action === 'connect') {
      // Validate connection code format
      const codeError = validateConnectionCode(code);
      if (codeError) {
        return new Response(
          JSON.stringify({ error: codeError, server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate driver name
      const nameError = validateDriverName(driverName);
      if (nameError) {
        return new Response(
          JSON.stringify({ error: nameError, server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find device with this connection code
      const { data: device, error: deviceError } = await supabaseAdmin
        .from('devices')
        .select('id, user_id, name, connected_driver_id, connection_code')
        .eq('connection_code', code.trim().toUpperCase())
        .maybeSingle();

      if (deviceError) {
        console.error('Device lookup error:', deviceError);
        return new Response(
          JSON.stringify({ error: 'Failed to find device', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Invalid connection code', server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this code is already assigned to a driver
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id, driver_name, admin_code')
        .eq('admin_code', code.trim().toUpperCase())
        .maybeSingle();

      // If driverId is provided, check if it's the same driver reconnecting
      const isReconnecting = driverId && existingDriver && existingDriver.driver_id === driverId;
      
      // If code is assigned to a different driver, reconnect as that driver (same name check)
      if (existingDriver && !isReconnecting) {
        console.log('Code already assigned to driver:', existingDriver.driver_id, 'Reconnecting...');
        
        // Update the existing driver's status and reconnect
        await supabaseAdmin
          .from('drivers')
          .update({
            status: 'active',
            last_seen_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
          })
          .eq('driver_id', existingDriver.driver_id);

        // Update device connection
        await supabaseAdmin
          .from('devices')
          .update({
            connected_driver_id: existingDriver.driver_id,
            connected_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', device.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            driverId: existingDriver.driver_id,
            device: { id: device.id, name: device.name },
            reconnected: true,
            existingDriverName: existingDriver.driver_name,
            server_time: serverTime,
            // Configuration for mobile app
            config: {
              locationUpdateIntervalMs: 15000,  // 15 seconds when moving
              heartbeatIntervalMs: 30000,       // 30 seconds
              stationaryIntervalMs: 60000,      // 60 seconds when stationary
              lowBatteryIntervalMs: 120000,     // 2 minutes when battery < 20%
              accuracyThresholdM: 1500,         // Max accuracy for storing location
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let finalDriverId: string;

      if (isReconnecting) {
        // Same driver reconnecting - update their status
        console.log('Same driver reconnecting:', driverId);
        finalDriverId = driverId;
        
        await supabaseAdmin
          .from('drivers')
          .update({
            driver_name: driverName.trim(),
            status: 'active',
            last_seen_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
          })
          .eq('driver_id', driverId);
      } else {
        // New driver connecting - generate new ID
        finalDriverId = generateDriverId();
        console.log('Creating new driver:', finalDriverId, 'with code:', code);
        
        const { error: insertError } = await supabaseAdmin
          .from('drivers')
          .insert({
            driver_id: finalDriverId,
            admin_code: code.trim().toUpperCase(),
            driver_name: driverName.trim(),
            status: 'active',
            connected_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating driver:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to register driver', server_time: serverTime }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update device connection
      await supabaseAdmin
        .from('devices')
        .update({
          connected_driver_id: finalDriverId,
          connected_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', device.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          driverId: finalDriverId,
          device: { id: device.id, name: device.name },
          server_time: serverTime,
          // Configuration for mobile app
          config: {
            locationUpdateIntervalMs: 15000,
            heartbeatIntervalMs: 30000,
            stationaryIntervalMs: 60000,
            lowBatteryIntervalMs: 120000,
            accuracyThresholdM: 1500,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update driver status
      await supabaseAdmin
        .from('drivers')
        .update({ status: 'offline', last_seen_at: new Date().toISOString() })
        .eq('driver_id', driverId);

      // Disconnect from device
      await supabaseAdmin
        .from('devices')
        .update({
          connected_driver_id: null,
          connected_at: null,
          status: 'offline',
        })
        .eq('connected_driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-connection') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ connected: false, device: null, server_time: serverTime }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get driver's current connection
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('admin_code, driver_name, status')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver || driver.status === 'offline') {
        return new Response(
          JSON.stringify({ connected: false, device: null, server_time: serverTime }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find associated device
      const { data: device } = await supabaseAdmin
        .from('devices')
        .select('id, name')
        .eq('connection_code', driver.admin_code)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          connected: true,
          device: device ? { id: device.id, name: device.name } : null,
          driverName: driver.driver_name,
          server_time: serverTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-status') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate driver exists before updating
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver) {
        console.log('Driver not found for update-status:', driverId);
        return new Response(
          JSON.stringify({ error: 'Driver not found', requiresRelogin: true, server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { status, batteryLevel } = body;
      
      // Update driver with optional device info including battery
      const updateData: any = { 
        status: status || 'active',
        last_seen_at: new Date().toISOString() 
      };
      
      // Store battery info in device_info JSON if provided
      if (batteryLevel !== undefined) {
        updateData.device_info = { batteryLevel, lastBatteryUpdate: serverTime };
      }
      
      await supabaseAdmin
        .from('drivers')
        .update(updateData)
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-name') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { name } = body;
      
      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Name is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin
        .from('drivers')
        .update({ driver_name: name.trim() })
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-location') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { latitude, longitude, speed, accuracy, bearing, batteryLevel, isBackground } = body;
      
      // Validate latitude and longitude
      if (!validateLatitude(latitude) || !validateLongitude(longitude)) {
        return new Response(
          JSON.stringify({ error: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate battery level if provided
      if (!validateBatteryLevel(batteryLevel)) {
        return new Response(
          JSON.stringify({ error: 'Invalid battery level. Must be 0-100', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate speed if provided
      if (!validateSpeed(speed)) {
        return new Response(
          JSON.stringify({ error: 'Invalid speed. Must be 0-500 km/h', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Filter out poor accuracy locations (> 1500m) for better tracking
      const accuracyValue = accuracy || 0;
      const isAccurate = accuracyValue <= 1500;
      
      console.log('Location update - Driver:', driverId, 
        'Lat:', latitude, 'Lng:', longitude, 
        'Speed:', speed, 'Bearing:', bearing,
        'Accuracy:', accuracyValue, 'Accurate:', isAccurate,
        'Battery:', batteryLevel, 'Background:', isBackground);

      // Get driver's admin_code
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('admin_code, device_info')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver) {
        console.log('Driver not found for update-location:', driverId);
        return new Response(
          JSON.stringify({ error: 'Driver not found', requiresRelogin: true, server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update driver's last_seen_at and device info
      const driverUpdate: any = { 
        status: 'active',
        last_seen_at: new Date().toISOString() 
      };
      
      // Merge device info
      if (batteryLevel !== undefined || bearing !== undefined) {
        driverUpdate.device_info = {
          ...(driver.device_info || {}),
          ...(batteryLevel !== undefined ? { batteryLevel } : {}),
          ...(bearing !== undefined ? { bearing } : {}),
          ...(isBackground !== undefined ? { isBackground } : {}),
          lastUpdate: serverTime,
        };
      }
      
      await supabaseAdmin
        .from('drivers')
        .update(driverUpdate)
        .eq('driver_id', driverId);

      // Only store location if accuracy is good
      if (isAccurate) {
        // Upsert current location
        const { error: locationError } = await supabaseAdmin
          .from('driver_locations')
          .upsert({
            driver_id: driverId,
            admin_code: driver.admin_code,
            latitude,
            longitude,
            speed: speed || null,
            accuracy: accuracyValue,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'driver_id' });

        if (locationError) {
          console.error('Location update error:', locationError);
        }

        // Also store in location history for tracking movement
        const { error: historyError } = await supabaseAdmin
          .from('driver_location_history')
          .insert({
            driver_id: driverId,
            admin_code: driver.admin_code,
            latitude,
            longitude,
            speed: speed || null,
            accuracy: accuracyValue,
            recorded_at: new Date().toISOString(),
          });

        if (historyError) {
          console.error('History insert error:', historyError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            stored: true, 
            accuracy: accuracyValue,
            server_time: serverTime,
            // Return next update interval based on battery
            nextUpdateMs: batteryLevel && batteryLevel < 20 ? 120000 : 
                          speed && speed > 5 ? 15000 : 60000
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Location too inaccurate, skip storing but still acknowledge
        console.log('Skipping inaccurate location - accuracy:', accuracyValue, 'm');
        return new Response(
          JSON.stringify({ 
            success: true, 
            stored: false, 
            accuracy: accuracyValue, 
            reason: 'accuracy_too_low',
            server_time: serverTime,
            nextUpdateMs: 15000 // Try again in 15 seconds
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action', server_time: serverTime }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message, server_time: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
