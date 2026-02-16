// Supabase Edge Function: notify-inactivity
// Sends email notifications for devices that newly became offline
// Replaces non-functional FCM with Resend email

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://gobo-fleet-mate.lovable.app';

const supabase = createClient(supabaseUrl, serviceKey);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { console.error('RESEND_API_KEY not set'); return { success: false }; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    const data = await res.json();
    if (!res.ok) { console.error('Resend error:', data); return { success: false }; }
    console.log('Inactivity email sent:', data.id);
    return { success: true };
  } catch (err) { console.error('Email error:', err); return { success: false }; }
}

function emailTemplate(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  const btn = actionUrl && actionLabel ? `<div style="text-align:center;margin:24px 0;"><a href="${actionUrl}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${actionLabel}</a></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">🚛 FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">${title}</h2><div style="color:#475569;font-size:14px;line-height:1.6;">${body}</div>${btn}</div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have a FleetTrackMate account.</p></div></div></div></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  const url = new URL(req.url);
  const testUser = url.searchParams.get('test_user');

  try {
    if (testUser) {
      // Test mode: send a test email to the user
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', testUser)
        .maybeSingle();

      if (profile?.email) {
        const html = emailTemplate('Test Notification', '<p>This is a test notification from FleetTrackMate. Your email notifications are working correctly! ✅</p>');
        const result = await sendEmail(profile.email, '✅ FleetTrackMate Test Notification', html);
        return json({ mode: 'test', email: profile.email, sent: result.success }, 200);
      }
      return json({ mode: 'test', error: 'No email found for user' }, 404);
    }

    // Find devices newly offline (status offline AND not yet notified since status change)
    const { data: devices, error: dErr } = await supabase
      .from('devices')
      .select('id, user_id, name, status, status_changed_at, last_notified_offline_at')
      .eq('status', 'offline');

    if (dErr) throw dErr;

    const toNotify = (devices ?? []).filter((d) => {
      if (!d.status_changed_at) return false;
      if (!d.last_notified_offline_at) return true;
      return new Date(d.last_notified_offline_at).getTime() < new Date(d.status_changed_at).getTime();
    });

    let sent = 0;
    for (const d of toNotify) {
      // Get device owner's email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', d.user_id)
        .maybeSingle();

      if (!profile?.email) continue;

      const deviceName = d.name || 'Device';
      const subject = `⚠️ ${deviceName} is offline`;
      const body = `
        <p>Hi ${profile.full_name || 'there'},</p>
        <p>Your device <strong>${deviceName}</strong> has gone <strong>offline</strong>.</p>
        <p>This may indicate a connectivity issue, power loss, or the device has been turned off.</p>
        <p>Last status change: ${d.status_changed_at ? new Date(d.status_changed_at).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC' : 'Unknown'}</p>
      `;

      const html = emailTemplate('Device Offline Alert', body, `${APP_URL}/dashboard`, 'View Dashboard');
      const result = await sendEmail(profile.email, subject, html);

      // Mark notified regardless of email success to avoid spam
      await supabase
        .from('devices')
        .update({ last_notified_offline_at: new Date().toISOString() })
        .eq('id', d.id);

      if (result.success) sent++;
    }

    return json({ scanned: devices?.length ?? 0, toNotify: toNotify.length, sent }, 200);
  } catch (e) {
    console.error('notify-inactivity error:', e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}
