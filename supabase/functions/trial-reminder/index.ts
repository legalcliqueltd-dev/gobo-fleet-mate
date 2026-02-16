// Trial expiration reminder - sends emails at 3 days remaining and on expiry day
// Designed to be called by a cron job (pg_cron via pg_net)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://gobo-fleet-mate.lovable.app';

// Default trial length in days
const TRIAL_DAYS = 14;

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: 'No API key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) { console.error('Resend error:', data); return { success: false, error: data.message }; }
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Get all trial users
    const { data: trialUsers, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, trial_started_at, subscription_end_at, last_trial_reminder_at')
      .eq('subscription_status', 'trial')
      .not('email', 'is', null);

    if (error) throw error;
    if (!trialUsers || trialUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No trial users found', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    let sent = 0;

    for (const user of trialUsers) {
      if (!user.email || !user.trial_started_at) continue;

      const trialStart = new Date(user.trial_started_at);
      const trialEnd = user.subscription_end_at 
        ? new Date(user.subscription_end_at) 
        : new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const lastReminder = user.last_trial_reminder_at ? new Date(user.last_trial_reminder_at) : null;
      
      // Deduplication: don't send more than once per day
      if (lastReminder && (now.getTime() - lastReminder.getTime()) < 20 * 60 * 60 * 1000) {
        continue;
      }

      const name = user.full_name || 'there';
      let shouldSend = false;
      let subject = '';
      let body = '';

      if (daysRemaining === 3) {
        shouldSend = true;
        subject = '⏰ Your FleetTrackMate trial ends in 3 days';
        body = `
          <p>Hi ${name},</p>
          <p>Your free trial ends in <strong>3 days</strong>. After that, you'll lose access to:</p>
          <ul>
            <li>Real-time driver tracking</li>
            <li>Task management & dispatch</li>
            <li>SOS emergency alerts</li>
            <li>Fleet analytics & reports</li>
          </ul>
          <p>Upgrade now to keep your fleet running smoothly.</p>
        `;
      } else if (daysRemaining <= 0) {
        shouldSend = true;
        subject = '🔒 Your FleetTrackMate trial has expired';
        body = `
          <p>Hi ${name},</p>
          <p>Your free trial has <strong>expired</strong>. Your account features are now limited.</p>
          <p>Upgrade today to restore full access to all fleet management features.</p>
        `;
      }

      if (shouldSend) {
        const html = emailTemplate(subject.replace(/^[^\s]+ /, ''), body, `${APP_URL}/settings`, 'Upgrade Now');
        const result = await sendEmail(user.email, subject, html);
        
        if (result.success) {
          await supabase
            .from('profiles')
            .update({ last_trial_reminder_at: now.toISOString() })
            .eq('id', user.id);
          sent++;
          console.log(`Trial reminder sent to ${user.email} (${daysRemaining} days remaining)`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, checked: trialUsers.length, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Trial reminder error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
