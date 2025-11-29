import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (action === 'connect') {
      if (!code?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Connection code is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!driverName?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Driver name is required' }),
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
          JSON.stringify({ error: 'Failed to find device' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Invalid connection code' }),
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
            existingDriverName: existingDriver.driver_name
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
            JSON.stringify({ error: 'Failed to register driver' }),
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
          device: { id: device.id, name: device.name }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required' }),
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
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-connection') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ connected: false, device: null }),
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
          JSON.stringify({ connected: false, device: null }),
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
          driverName: driver.driver_name
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-status') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { status } = body;
      
      await supabaseAdmin
        .from('drivers')
        .update({ 
          status: status || 'active',
          last_seen_at: new Date().toISOString() 
        })
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-name') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { name } = body;
      
      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Name is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin
        .from('drivers')
        .update({ driver_name: name.trim() })
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-location') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { latitude, longitude, speed, accuracy } = body;
      
      if (latitude === undefined || longitude === undefined) {
        return new Response(
          JSON.stringify({ error: 'Latitude and longitude are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get driver's admin_code
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('admin_code')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Driver not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert location
      const { error: locationError } = await supabaseAdmin
        .from('driver_locations')
        .upsert({
          driver_id: driverId,
          admin_code: driver.admin_code,
          latitude,
          longitude,
          speed: speed || null,
          accuracy: accuracy || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'driver_id' });

      if (locationError) {
        console.error('Location update error:', locationError);
        return new Response(
          JSON.stringify({ error: 'Failed to update location' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also update driver's last_seen_at
      await supabaseAdmin
        .from('drivers')
        .update({ 
          status: 'active',
          last_seen_at: new Date().toISOString() 
        })
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
