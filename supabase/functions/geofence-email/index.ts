// Geofence breach email notification
// Called when a driver enters or exits a geofence zone

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@gobotracking.com>';
const APP_URL = 'https://gobo-fleet-mate.lovable.app';

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: 'No API key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) { console.error('Resend error:', data); return { success: false }; }
  return { success: true, id: data.id };
}

function emailTemplate(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  const btn = actionUrl && actionLabel ? `<div style="text-align:center;margin:24px 0;"><a href="${actionUrl}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${actionLabel}</a></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">🚛 FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">${title}</h2><div style="color:#475569;font-size:14px;line-height:1.6;">${body}</div>${btn}</div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have a FleetTrackMate account.</p></div></div></div></body></html>`;
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
