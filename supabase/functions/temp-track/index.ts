import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, token, latitude, longitude, speed, nickname } = await req.json();

    console.log(`temp-track: action=${action}, token=${token}`);

    // Fetch session by token
    const { data: session, error: sessionError } = await supabase
      .from('temp_track_sessions')
      .select('*')
      .eq('token', token)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired tracking link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from('temp_track_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id);
      
      return new Response(
        JSON.stringify({ error: 'Tracking link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if revoked
    if (session.status === 'revoked') {
      return new Response(
        JSON.stringify({ error: 'Tracking link has been revoked' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'claim': {
        // Create temporary device if not already claimed
        if (!session.device_id) {
          const deviceName = nickname || session.label || 'Guest Tracker';
          
          const { data: device, error: deviceError } = await supabase
            .from('devices')
            .insert({
              user_id: session.owner_user_id,
              name: deviceName,
              status: 'active',
              is_temporary: true,
            })
            .select('id')
            .single();

          if (deviceError) {
            console.error('Failed to create device:', deviceError);
            return new Response(
              JSON.stringify({ error: 'Failed to create tracking device' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          await supabase
            .from('temp_track_sessions')
            .update({
              device_id: device.id,
              status: 'claimed',
              claimed_at: new Date().toISOString(),
              guest_nickname: nickname || null,
            })
            .eq('id', session.id);

          console.log(`Created temporary device ${device.id} for session ${session.id}`);
          
          return new Response(
            JSON.stringify({ success: true, deviceId: device.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, deviceId: session.device_id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!session.device_id) {
          return new Response(
            JSON.stringify({ error: 'Session not claimed yet' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Insert location update
        const { error: locationError } = await supabase
          .from('locations')
          .insert({
            device_id: session.device_id,
            latitude,
            longitude,
            speed: speed || 0,
            timestamp: new Date().toISOString(),
          });

        if (locationError) {
          console.error('Failed to insert location:', locationError);
          return new Response(
            JSON.stringify({ error: 'Failed to update location' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update last seen
        await supabase
          .from('temp_track_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', session.id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'stop': {
        // Mark session as revoked and set device offline
        if (session.device_id) {
          await supabase
            .from('devices')
            .update({ status: 'offline' })
            .eq('id', session.device_id);
        }

        await supabase
          .from('temp_track_sessions')
          .update({ status: 'revoked' })
          .eq('id', session.id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in temp-track function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
