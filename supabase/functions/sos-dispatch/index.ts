// Supabase Edge Function: sos-dispatch
// Sends notifications + emails when SOS events are created, acknowledged, or resolved

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://gobo-fleet-mate.lovable.app';

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
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
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
  // Find admin email via admin_code -> devices.connection_code -> devices.user_id -> profiles.email
  let adminEmail: string | null = null;
  let adminName: string | null = null;

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

      adminEmail = profile?.email || null;
      adminName = profile?.full_name || null;
    }
  }

  // Fallback: if SOS has user_id, check user_roles for admins
  if (!adminEmail && sosEvent.user_id) {
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminRoles?.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email, full_name')
        .in('id', adminRoles.map(r => r.user_id))
        .not('email', 'is', null);

      if (profiles?.length) {
        adminEmail = profiles[0].email;
        adminName = profiles[0].full_name;
      }
    }
  }

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

  const subject = `🚨 EMERGENCY: SOS Alert from ${driverDisplayName}`;
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

async function notifyAdmins(sosEvent: any) {
  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  if (!adminRoles || adminRoles.length === 0) {
    console.log('No admins to notify');
    return;
  }

  const adminIds = adminRoles.map((r) => r.user_id);
  const { data: tokens } = await supabase
    .from('notification_tokens')
    .select('token')
    .in('user_id', adminIds);

  if (!tokens || tokens.length === 0) {
    console.log('No admin tokens found');
    return;
  }

  console.log(`Would notify ${tokens.length} admins about SOS: ${sosEvent.hazard}`);
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
