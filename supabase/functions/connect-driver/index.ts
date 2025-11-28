import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('=== CONNECT-DRIVER FUNCTION INVOKED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use SERVICE_ROLE_KEY to validate user tokens server-side
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    
    // Regular client for database operations with RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    console.log('Auth header value (first 50 chars):', authHeader?.substring(0, 50));
    
    // Log all headers for debugging
    const headersList: string[] = [];
    req.headers.forEach((value, key) => {
      headersList.push(`${key}: ${value.substring(0, 30)}...`);
    });
    console.log('All headers:', headersList.join(', '));
    
    if (!authHeader) {
      console.log('ERROR: No Authorization header found');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);
    
    // Use admin client to validate user token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    console.log('User lookup result - User ID:', user?.id);
    console.log('User lookup result - Email:', user?.email);
    console.log('User lookup error:', userError?.message);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, code } = body;
    console.log('Action:', action, 'Code:', code);

    if (action === 'connect') {
      console.log('Looking up device with code:', code);
      
      // Find device with this connection code
      const { data: device, error: deviceError } = await supabaseClient
        .from('devices')
        .select('id, user_id, name, connected_driver_id')
        .eq('connection_code', code)
        .maybeSingle();

      console.log('Device lookup result:', device, deviceError);

      if (deviceError) {
        console.error('Device lookup error:', deviceError);
        return new Response(
          JSON.stringify({ error: 'Failed to find device' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!device) {
        console.log('No device found with code:', code);
        return new Response(
          JSON.stringify({ error: 'Invalid connection code' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Device found:', device.id, device.name);

      // Check if device is already connected to another driver
      if (device.connected_driver_id && device.connected_driver_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Device is already connected to another driver' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Connect the driver to the device
      const { error: updateError } = await supabaseClient
        .from('devices')
        .update({
          connected_driver_id: user.id,
          connected_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', device.id);

      if (updateError) {
        console.error('Device update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to connect to device' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create driver connection record
      const { error: connectionError } = await supabaseClient
        .from('driver_connections')
        .upsert({
          admin_user_id: device.user_id,
          driver_user_id: user.id,
          status: 'active',
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'admin_user_id,driver_user_id'
        });

      if (connectionError) {
        console.log('Driver connection warning:', connectionError);
        // Don't fail the request if this fails, it's supplementary
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          device: {
            id: device.id,
            name: device.name,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      // Disconnect driver from all devices
      const { error: disconnectError } = await supabaseClient
        .from('devices')
        .update({
          connected_driver_id: null,
          connected_at: null,
          status: 'offline',
        })
        .eq('connected_driver_id', user.id);

      if (disconnectError) {
        console.error('Disconnect error:', disconnectError);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-connection') {
      // Get current driver connection
      const { data: device, error: deviceError } = await supabaseClient
        .from('devices')
        .select('id, name, connection_code, user_id')
        .eq('connected_driver_id', user.id)
        .maybeSingle();

      if (deviceError) {
        console.error('Device lookup error:', deviceError);
        return new Response(
          JSON.stringify({ error: 'Failed to get connection' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          connected: !!device,
          device: device ? {
            id: device.id,
            name: device.name,
          } : null
        }),
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