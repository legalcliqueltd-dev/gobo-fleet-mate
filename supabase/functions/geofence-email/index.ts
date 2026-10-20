// Geofence breach email notification
// Called when a driver enters or exits a geofence zone

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { legacyEmail } from '../_shared/email.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'TrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://fleettrackmate.com';

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: 'No API key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' } }),
  });
  const data = await res.json();
  if (!res.ok) { console.error('Resend error:', data); return { success: false }; }
  return { success: true, id: data.id };
}

function emailTemplate(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  return legacyEmail(title, body, actionUrl, actionLabel);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { geofenceId, geofenceName, driverName, eventType, latitude, longitude } = await req.json();

    if (!geofenceId || !eventType) {
      return new Response(JSON.stringify({ error: 'geofenceId and eventType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Look up geofence creator
    const { data: geofence } = await supabase
      .from('geofences')
      .select('created_by, name')
      .eq('id', geofenceId)
      .maybeSingle();

    if (!geofence) {
      return new Response(JSON.stringify({ error: 'Geofence not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get creator's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', geofence.created_by)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: 'Creator email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const zoneName = geofenceName || geofence.name;
    const driver = driverName || 'A driver';
    const action = eventType === 'entry' ? 'entered' : 'exited';
    const emoji = eventType === 'entry' ? '📍' : '🚪';

    const subject = `${emoji} Geofence Alert: ${driver} ${action} "${zoneName}"`;
    const body = `
      <p>Hi ${profile.full_name || 'there'},</p>
      <p><strong>${driver}</strong> has <strong>${action}</strong> the geofence zone "<strong>${zoneName}</strong>".</p>
      ${latitude && longitude ? `<p>📍 Location: <a href="https://www.google.com/maps?q=${latitude},${longitude}">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</a></p>` : ''}
      <p>Time: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
    `;

    const html = emailTemplate(`Geofence ${eventType === 'entry' ? 'Entry' : 'Exit'} Alert`, body, `${APP_URL}/geofences`, 'View Geofences');
    const result = await sendEmail(profile.email, subject, html);

    return new Response(JSON.stringify({ success: result.success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Geofence email error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
