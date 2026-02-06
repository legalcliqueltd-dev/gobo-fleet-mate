import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  console.log('=== SOS-CREATE FUNCTION INVOKED ===');
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
    const { driverId, adminCode, latitude, longitude, message, hazard, photoUrl } = body;
    
    console.log('SOS Request:', { driverId, adminCode, latitude, longitude, hazard });

    // Validate required fields
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: 'Driver ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adminCode) {
      return new Response(
        JSON.stringify({ error: 'Admin code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate driver exists and is connected to this admin
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('driver_id, admin_code, driver_name')
      .eq('driver_id', driverId)
      .eq('admin_code', adminCode)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup error:', driverError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify driver' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found or not connected to this fleet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create SOS event using service role (bypasses RLS)
    const { data: sosEvent, error: sosError } = await supabaseAdmin
      .from('sos_events')
      .insert({
        user_id: null,  // Code-based driver, no auth user
        driver_id: driverId,
        admin_code: adminCode,
        latitude: latitude || null,
        longitude: longitude || null,
        message: message || 'Emergency SOS triggered',
        status: 'open',
        hazard: hazard || 'other',
        photo_url: photoUrl || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sosError) {
      console.error('SOS creation error:', sosError);
      return new Response(
        JSON.stringify({ error: 'Failed to create SOS event', details: sosError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SOS event created successfully:', sosEvent.id);

    // Get admin user ID to notify (find from device with this admin_code)
    const { data: device } = await supabaseAdmin
      .from('devices')
      .select('user_id')
      .eq('connection_code', adminCode)
      .maybeSingle();

    // Log notification (Realtime subscription on admin side will handle the actual alert)
    console.log('SOS Alert Details:', {
      sosId: sosEvent.id,
      driverId: driverId,
      driverName: driver.driver_name,
      adminCode: adminCode,
      adminUserId: device?.user_id,
      location: { lat: latitude, lng: longitude },
      hazard: hazard,
      message: message,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sosId: sosEvent.id,
        message: 'SOS alert sent successfully',
        driverName: driver.driver_name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SOS-CREATE error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
