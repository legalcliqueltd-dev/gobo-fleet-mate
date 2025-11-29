import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, code, driverName } = body;
    console.log('Action:', action, 'Code:', code, 'User:', user.id);

    if (action === 'connect') {
      // Find device with this connection code
      const { data: device, error: deviceError } = await supabaseAdmin
        .from('devices')
        .select('id, user_id, name, connected_driver_id, connection_code')
        .eq('connection_code', code)
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

      // Check if this code is already assigned to a DIFFERENT driver
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id, driver_name, admin_code')
        .eq('admin_code', code)
        .maybeSingle();

      if (existingDriver && existingDriver.driver_id !== user.id) {
        // Code is assigned to a different driver - reject
        console.log('Code already assigned to different driver:', existingDriver.driver_id);
        return new Response(
          JSON.stringify({ error: 'This code is already assigned to another driver' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get driver's profile for their real name
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle();

      // Determine driver name: provided name > existing name > profile name > email prefix
      const resolvedName = driverName?.trim() || 
        existingDriver?.driver_name ||
        profile?.full_name?.trim() || 
        user.email?.split('@')[0] || 
        'Driver';

      if (existingDriver) {
        // Same driver reconnecting - update their status
        console.log('Same driver reconnecting:', user.id);
        await supabaseAdmin
          .from('drivers')
          .update({
            driver_name: resolvedName,
            status: 'active',
            last_seen_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
          })
          .eq('admin_code', code);
      } else {
        // New driver connecting - check if this driver already has a different code
        const { data: existingDriverRecord } = await supabaseAdmin
          .from('drivers')
          .select('admin_code')
          .eq('driver_id', user.id)
          .maybeSingle();

        if (existingDriverRecord) {
          // Driver already has a code - update to new code
          console.log('Driver switching from code', existingDriverRecord.admin_code, 'to', code);
          const { error: updateError } = await supabaseAdmin
            .from('drivers')
            .update({
              admin_code: code,
              driver_name: resolvedName,
              status: 'active',
              connected_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
            })
            .eq('driver_id', user.id);

          if (updateError) {
            console.error('Error updating driver:', updateError);
            return new Response(
              JSON.stringify({ error: 'Failed to update driver connection' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Brand new driver - create entry
          console.log('Creating new driver:', user.id, 'with code:', code);
          const { error: insertError } = await supabaseAdmin
            .from('drivers')
            .insert({
              driver_id: user.id,
              admin_code: code,
              driver_name: resolvedName,
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
      }

      // Update device connection
      await supabaseAdmin
        .from('devices')
        .update({
          connected_driver_id: user.id,
          connected_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', device.id);

      // Upsert driver connection record
      await supabaseAdmin
        .from('driver_connections')
        .upsert({
          admin_user_id: device.user_id,
          driver_user_id: user.id,
          status: 'active',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'admin_user_id,driver_user_id' });

      return new Response(
        JSON.stringify({ 
          success: true, 
          device: { id: device.id, name: device.name }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      // Update driver status
      await supabaseAdmin
        .from('drivers')
        .update({ status: 'offline', last_seen_at: new Date().toISOString() })
        .eq('driver_id', user.id);

      // Disconnect from device
      await supabaseAdmin
        .from('devices')
        .update({
          connected_driver_id: null,
          connected_at: null,
          status: 'offline',
        })
        .eq('connected_driver_id', user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-connection') {
      // Get driver's current connection
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('admin_code, driver_name, status')
        .eq('driver_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!driver) {
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
      const { status } = body;
      
      await supabaseAdmin
        .from('drivers')
        .update({ 
          status: status || 'active',
          last_seen_at: new Date().toISOString() 
        })
        .eq('driver_id', user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-name') {
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
        .eq('driver_id', user.id);

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
