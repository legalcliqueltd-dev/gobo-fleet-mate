import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { legacyEmail, invoiceEmail } from '../_shared/email.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'TrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://fleettrackmate.com';
const TRIAL_DAYS = 7;

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { success: false, error: 'No API key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' } }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.message || 'Send failed' };
  return { success: true, id: data.id };
}

function emailTemplate(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  return legacyEmail(title, body, actionUrl, actionLabel);
}

function trialExpiredBody(name: string) {
  return `<p>Hi ${name},</p><p>Your free trial has <strong>expired</strong>. Your account features are now limited.</p><p>Upgrade today to restore full access to all fleet management features including:</p><ul><li>Real-time driver tracking</li><li>Task management & dispatch</li><li>SOS emergency alerts</li><li>Fleet analytics & reports</li></ul><p>Don't lose your fleet data — upgrade now.</p>`;
}

function invoiceHtml(name: string, plan: string, amount: string, provider: string, renewalDate: string, daysRemaining: number, invoiceDate: string) {
  return invoiceEmail({ name, plan, amount, provider, renewalDate, daysRemaining, invoiceDate });
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

    // Auth check — must be admin, service role, or internal automation
    const authHeader = req.headers.get('Authorization');
    const internalKey = req.headers.get('x-internal-key');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    // Allow internal automation calls with anon key as x-internal-key header
    const isInternalCall = internalKey && (internalKey === serviceRoleKey || internalKey === anonKey);
    
    if (!isInternalCall) {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const token = authHeader.replace('Bearer ', '');
      
      // Allow service role key for automated/internal calls
      const isServiceRole = token === serviceRoleKey;
      
      if (!isServiceRole) {
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // MUST be platform_owner, not 'admin'. Every signup is handed 'admin'
        // by the trigger in migration 20260209155655, so gating on it let any
        // customer mail the entire user base from our own domain.
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id)
          .eq('role', 'platform_owner')
          .maybeSingle();
        if (!roleData) {
          console.warn(`bulk-email: refused non-owner ${userData.user.id}`);
          return new Response(JSON.stringify({ error: 'Platform owner access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    const body = await req.json();
    const filter: string = body.filter || 'all';
    const customSubject: string | undefined = body.subject;
    // NOTE: body.html is deliberately ignored. Letting a caller supply the
    // body means the worst case of any future auth slip is a phishing mail
    // sent from noreply@fleettrackmate.com, wearing our template. Custom
    // sends get our wrapper around plain text instead.
    const customText: string | undefined = body.text;

    // Build query
    let query = supabase.from('profiles').select('id, email, full_name, trial_started_at, subscription_status, subscription_end_at, subscription_plan, payment_provider').not('email', 'is', null);

    if (filter === 'trial') {
      query = query.eq('subscription_status', 'trial');
    } else if (filter === 'active' || filter === 'paid') {
      query = query.eq('subscription_status', 'active');
    } else if (filter === 'expired') {
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

      if (filter === 'paid' && !customSubject) {
        const plan = (profile.subscription_plan || 'pro').charAt(0).toUpperCase() + (profile.subscription_plan || 'pro').slice(1);
        const amount = profile.subscription_plan === 'basic' ? '$1.99/month' : '$3.99/month';
        const provider = (profile.payment_provider || 'Stripe').charAt(0).toUpperCase() + (profile.payment_provider || 'stripe').slice(1);
        const endDate = profile.subscription_end_at ? new Date(profile.subscription_end_at) : null;
        const renewalDate = endDate ? endDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
        const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        const invoiceDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        subject = `TrackMate Invoice - ${plan} Plan`;
        html = invoiceHtml(name, plan, amount, provider, renewalDate, daysRemaining, invoiceDate);
      } else if (filter === 'expired' && !customSubject) {
        subject = 'Your TrackMate trial has expired';
        html = emailTemplate('Your trial has expired', trialExpiredBody(name), `${APP_URL}/settings`, 'Upgrade Now');
      } else {
        subject = customSubject || 'Update from TrackMate';
        const bodyText = (customText || 'We have an important update for you. Please log in to your dashboard for details.')
          .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
        html = emailTemplate('Important Update', `<p>Hi ${name},</p><p>${bodyText}</p>`, APP_URL, 'Go to Dashboard');
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
