// Supabase Edge Function: sos-dispatch
// Sends notifications + emails when SOS events are created, acknowledged, or resolved

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://fleettrackmate.com';

const supabase = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { console.error('RESEND_API_KEY not set'); return; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' } }),
    });
    const data = await res.json();
    if (!res.ok) console.error('Resend error:', data);
    else console.log('SOS email sent:', data.id, 'to:', to);
  } catch (err) { console.error('Email send error:', err); }
}

function emailTemplate(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  const btn = actionUrl && actionLabel ? `<div style="text-align:center;margin:24px 0;"><a href="${actionUrl}" style="background-color:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${actionLabel}</a></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#991b1b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">🚨 FleetTrackMate EMERGENCY</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">${title}</h2><div style="color:#475569;font-size:14px;line-height:1.6;">${body}</div>${btn}</div><div style="padding:16px 24px;background:#fef2f2;border-top:1px solid #fecaca;"><p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated emergency notification from FleetTrackMate.</p></div></div></div></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, record } = await req.json();
    console.log('SOS Dispatch:', type, record);

    if (type === 'INSERT' && record.status === 'open') {
      await notifyAdmins(record);
      await emailAdminOnSOS(record);
      await emailDriverOnSOS(record);
    } else if (type === 'UPDATE') {
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

async function emailAdminOnSOS(sosEvent: any) {
  const owner = await resolveOwningAdmin(sosEvent);
  const adminEmail = owner?.email ?? null;
  const adminName = owner?.name ?? null;

  if (!adminEmail) {
    console.log('No admin email found for SOS notification');
    return;
  }

  // Get driver name
  let driverDisplayName = 'Unknown Driver';
  if (sosEvent.driver_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('driver_name')
      .eq('driver_id', sosEvent.driver_id)
      .maybeSingle();
    if (driver?.driver_name) driverDisplayName = driver.driver_name;
  }

  const hazard = sosEvent.hazard || 'other';
  const hazardEmoji: Record<string, string> = {
    accident: '💥', medical: '🏥', robbery: '🚨', breakdown: '🔧', other: '⚠️'
  };

  const locationLink = sosEvent.latitude && sosEvent.longitude
    ? `<a href="https://www.google.com/maps?q=${sosEvent.latitude},${sosEvent.longitude}">View on Map</a>`
    : 'Location not available';

  const subject = `EMERGENCY: SOS Alert from ${driverDisplayName}`;
  const body = `
    <p>Hi ${adminName || 'Admin'},</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#991b1b;">${hazardEmoji[hazard] || '⚠️'} ${hazard.charAt(0).toUpperCase() + hazard.slice(1)} Emergency</p>
      <p style="margin:0;"><strong>Driver:</strong> ${driverDisplayName}</p>
      ${sosEvent.message ? `<p style="margin:4px 0 0;"><strong>Message:</strong> ${sosEvent.message}</p>` : ''}
      <p style="margin:4px 0 0;"><strong>Location:</strong> ${locationLink}</p>
      <p style="margin:4px 0 0;"><strong>Time:</strong> ${new Date(sosEvent.created_at || Date.now()).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
    </div>
    <p><strong>Immediate action is required.</strong> Please check the incidents panel and coordinate a response.</p>
  `;

  const html = emailTemplate('SOS Alert Received', body, `${APP_URL}/ops/incidents`, 'View Incidents');
  await sendEmail(adminEmail, subject, html);
}

/**
 * The one manager this SOS belongs to.
 *
 * admin_code is the reliable route: it is the connection code the driver
 * joined with, and it maps to exactly one device and therefore one owner.
 * user_id is only a fallback because sos-create sets it to null for
 * code-based drivers, which is every driver.
 *
 * Returns null rather than guessing. There is no such thing as a reasonable
 * default recipient for an emergency alert.
 */
async function resolveOwningAdmin(
  sosEvent: any
): Promise<{ id: string; email: string | null; name: string | null } | null> {
  if (sosEvent.admin_code) {
    const { data: device } = await supabase
      .from('devices')
      .select('user_id')
      .eq('connection_code', sosEvent.admin_code)
      .maybeSingle();

    if (device?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', device.user_id)
        .maybeSingle();
      return { id: device.user_id, email: profile?.email ?? null, name: profile?.full_name ?? null };
    }
  }

  if (sosEvent.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', sosEvent.user_id)
      .maybeSingle();
    if (profile) {
      return { id: sosEvent.user_id, email: profile.email ?? null, name: profile.full_name ?? null };
    }
  }

  return null;
}

async function notifyAdmins(sosEvent: any) {
  // Scoped to the owning manager. This used to gather push tokens for every
  // account holding role='admin' — which the signup trigger grants to
  // everyone — so implementing the send would have pushed one fleet's
  // emergency to every user on the platform.
  const owner = await resolveOwningAdmin(sosEvent);
  if (!owner) {
    console.log('No owning admin resolved; not notifying');
    return;
  }

  const { data: tokens } = await supabase
    .from('notification_tokens')
    .select('token')
    .eq('user_id', owner.id);

  if (!tokens || tokens.length === 0) {
    console.log('No admin tokens found');
    return;
  }

  console.log(`Would notify ${tokens.length} device(s) for admin ${owner.id} about SOS: ${sosEvent.hazard}`);
}

async function notifyDriver(sosEvent: any, message: string) {
  const { data: tokens } = await supabase
    .from('notification_tokens')
    .select('token')
    .eq('user_id', sosEvent.user_id);

  if (!tokens || tokens.length === 0) {
    console.log('No driver tokens found');
    return;
  }

  console.log(`Would notify driver about: ${message}`);
}

async function emailDriverOnSOS(sosEvent: any) {
  // Get driver info including the admin's email to find driver email
  let driverDisplayName = 'Driver';
  let driverEmail: string | null = null;

  if (sosEvent.driver_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('driver_name')
      .eq('driver_id', sosEvent.driver_id)
      .maybeSingle();
    if (driver?.driver_name) driverDisplayName = driver.driver_name;
  }

  // Try to find a user profile for the driver via user_id
  if (sosEvent.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', sosEvent.user_id)
      .maybeSingle();
    driverEmail = profile?.email || null;
  }

  if (!driverEmail) {
    console.log('No driver email found for SOS confirmation');
    return;
  }

  const hazard = sosEvent.hazard || 'other';
  const hazardLabels: Record<string, string> = {
    accident: 'Accident', medical: 'Medical Emergency', robbery: 'Robbery/Theft', breakdown: 'Vehicle Breakdown', other: 'Emergency'
  };

  const locationLink = sosEvent.latitude && sosEvent.longitude
    ? `<a href="https://maps.google.com/?q=${sosEvent.latitude},${sosEvent.longitude}" style="color:#2563eb;">View on Google Maps</a>`
    : 'Location not available';

  const timestamp = new Date(sosEvent.created_at || Date.now()).toLocaleString('en-US', { timeZone: 'UTC' });
  const sosDetailLink = `${APP_URL}/ops/incidents`;

  const incidentSummary = `SOS triggered by ${driverDisplayName} — ${hazardLabels[hazard] || 'Emergency'}${sosEvent.message ? ': ' + sosEvent.message : ''}. Coordinates: ${sosEvent.latitude?.toFixed(5) || 'N/A'}, ${sosEvent.longitude?.toFixed(5) || 'N/A'}.`;

  const subject = `SOS Received — Your Emergency Alert Has Been Sent`;
  const body = `
    <p>Hi ${driverDisplayName},</p>
    <p>Your SOS alert has been <strong>received and sent to your dispatcher</strong>. Help is being coordinated.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#166534;">Incident Summary</p>
      <p style="margin:4px 0;"><strong>Type:</strong> ${hazardLabels[hazard] || 'Emergency'}</p>
      <p style="margin:4px 0;"><strong>Driver:</strong> ${driverDisplayName} (${sosEvent.driver_id || 'N/A'})</p>
      <p style="margin:4px 0;"><strong>Time:</strong> ${timestamp} UTC</p>
      <p style="margin:4px 0;"><strong>Location:</strong> ${locationLink}</p>
      ${sosEvent.message ? `<p style="margin:4px 0;"><strong>Message:</strong> ${sosEvent.message}</p>` : ''}
    </div>
    <p style="color:#475569;font-size:13px;">Stay where you are if safe to do so. Your dispatcher has been notified and will reach out shortly.</p>
  `;

  const html = emailTemplate('Your SOS Alert Was Received', body, sosDetailLink, 'View Incident Status');
  await sendEmail(driverEmail, subject, html);
  console.log('SOS confirmation email sent to driver:', driverEmail);
}
