// Supabase Edge Function: sos-dispatch
// Sends notifications when SOS events are created, acknowledged, or resolved
// Triggered by database webhook or called directly

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, record } = await req.json();

    console.log('SOS Dispatch:', type, record);

    if (type === 'INSERT' && record.status === 'open') {
      // New SOS created - notify all admins
      await notifyAdmins(record);
    } else if (type === 'UPDATE') {
      // SOS acknowledged or resolved - notify the driver
      if (record.status === 'acknowledged') {
        await notifyDriver(record, 'Your SOS has been acknowledged. Help is on the way.');
      } else if (record.status === 'resolved') {
        await notifyDriver(record, 'Your SOS has been resolved.');
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('SOS dispatch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function notifyAdmins(sosEvent: any) {
  // Get all admin user IDs
  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  if (!adminRoles || adminRoles.length === 0) {
    console.log('No admins to notify');
    return;
  }

  const adminIds = adminRoles.map((r) => r.user_id);

  // Get notification tokens for admins
  const { data: tokens } = await supabase
    .from('notification_tokens')
    .select('token')
    .in('user_id', adminIds);

  if (!tokens || tokens.length === 0) {
    console.log('No admin tokens found');
    return;
  }

  // In production, you would send push notifications here
  // For now, we'll just log
  console.log(`Would notify ${tokens.length} admins about SOS: ${sosEvent.hazard}`);
  
  // Example: Send to FCM (if you had FCM_SERVER_KEY configured)
  // const fcmKey = Deno.env.get('FCM_SERVER_KEY');
  // if (fcmKey) {
  //   await sendFCM(tokens.map(t => t.token), 'Emergency SOS', `${sosEvent.hazard} alert`);
  // }
}

async function notifyDriver(sosEvent: any, message: string) {
  // Get notification tokens for the driver
  const { data: tokens } = await supabase
    .from('notification_tokens')
    .select('token')
    .eq('user_id', sosEvent.user_id);

  if (!tokens || tokens.length === 0) {
    console.log('No driver tokens found');
    return;
  }

  console.log(`Would notify driver about: ${message}`);
  
  // Example: Send to FCM
  // const fcmKey = Deno.env.get('FCM_SERVER_KEY');
  // if (fcmKey) {
  //   await sendFCM(tokens.map(t => t.token), 'SOS Update', message);
  // }
}
