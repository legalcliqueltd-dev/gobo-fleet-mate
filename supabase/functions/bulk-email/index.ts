import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://gobo-fleet-mate.lovable.app';
const TRIAL_DAYS = 7;

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: 'No API key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.message || 'Send failed' };
  return { success: true, id: data.id };
}

function emailTemplate(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  const btn = actionUrl && actionLabel ? `<div style="text-align:center;margin:24px 0;"><a href="${actionUrl}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${actionLabel}</a></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">🚛 FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">${title}</h2><div style="color:#475569;font-size:14px;line-height:1.6;">${body}</div>${btn}</div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have a FleetTrackMate account.</p></div></div></div></body></html>`;
}

function trialExpiredBody(name: string) {
  return `<p>Hi ${name},</p><p>Your free trial has <strong>expired</strong>. Your account features are now limited.</p><p>Upgrade today to restore full access to all fleet management features including:</p><ul><li>Real-time driver tracking</li><li>Task management & dispatch</li><li>SOS emergency alerts</li><li>Fleet analytics & reports</li></ul><p>Don't lose your fleet data — upgrade now.</p>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Auth check — must be admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const filter: string = body.filter || 'all';
    const customSubject: string | undefined = body.subject;
    const customHtml: string | undefined = body.html;

    // Build query
    let query = supabase.from('profiles').select('id, email, full_name, trial_started_at, subscription_status, subscription_end_at').not('email', 'is', null);

    if (filter === 'trial') {
      query = query.eq('subscription_status', 'trial');
    } else if (filter === 'active') {
      query = query.eq('subscription_status', 'active');
    } else if (filter === 'expired') {
      // Get trial + expired users whose trial has actually expired
      query = query.in('subscription_status', ['expired', 'trial']);
    }
    // 'all' = no extra filter

    const { data: profiles, error: profileErr } = await query;
    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No matching users found', sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      if (!profile.email) continue;

      // For expired filter, verify trial is actually expired
      if (filter === 'expired') {
        const trialStart = profile.trial_started_at ? new Date(profile.trial_started_at) : null;
        if (trialStart) {
          const trialEnd = profile.subscription_end_at
            ? new Date(profile.subscription_end_at)
            : new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
          if (now < trialEnd) continue; // still active trial
        } else if (profile.subscription_status !== 'expired') {
          continue;
        }
      }

      const name = profile.full_name || 'there';
      let subject: string;
      let html: string;

      if (filter === 'expired' && !customSubject) {
        subject = '🔒 Your FleetTrackMate trial has expired';
        html = emailTemplate('Your trial has expired', trialExpiredBody(name), `${APP_URL}/settings`, 'Upgrade Now');
      } else {
        subject = customSubject || '📢 Update from FleetTrackMate';
        html = customHtml || emailTemplate('Important Update', `<p>Hi ${name},</p><p>We have an important update for you. Please log in to your dashboard for details.</p>`, APP_URL, 'Go to Dashboard');
      }

      const result = await sendEmail(profile.email, subject, html);
      if (result.success) {
        sent++;
        console.log(`Sent to ${profile.email}`);
      } else {
        failed++;
        errors.push(`${profile.email}: ${result.error}`);
        console.error(`Failed: ${profile.email} - ${result.error}`);
      }

      // Small delay to respect rate limits
      if (profiles.length > 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return new Response(JSON.stringify({ success: true, sent, failed, total: profiles.length, errors: errors.slice(0, 10) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Bulk email error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
