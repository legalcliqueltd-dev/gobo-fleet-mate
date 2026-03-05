import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';

async function sendPaymentConfirmationEmail(email: string, plan: string, expiryDate: string, provider: string) {
  if (!RESEND_API_KEY) return;
  const expiry = new Date(expiryDate);
  const formattedExpiry = expiry.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const priceLabel = plan === 'pro' ? '$3.99' : '$1.99';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">FleetTrackMate</h1></div>
      <div style="padding:24px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:56px;height:56px;background:#22c55e;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:28px;">&#10003;</span></div>
          <h2 style="margin:0;color:#1e293b;font-size:22px;">Payment Confirmed</h2>
        </div>
        <div style="color:#475569;font-size:14px;line-height:1.6;">
          <p>Your subscription has been activated successfully.</p>
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${plan.charAt(0).toUpperCase() + plan.slice(1)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${priceLabel}/month</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${provider.charAt(0).toUpperCase() + provider.slice(1)}</td></tr>
              <tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px 0 6px;color:#64748b;font-size:13px;">Next Renewal</td><td style="padding:8px 0 6px;text-align:right;font-weight:600;color:#1e293b;">${formattedExpiry}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Days Remaining</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#22c55e;">${daysRemaining} days</td></tr>
            </table>
          </div>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://fleettrackmate.com/dashboard" style="background-color:#2563eb;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Go to Dashboard</a>
        </div>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">Manage your subscription from your dashboard settings.</p></div>
    </div>
  </div>
</body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: `Payment Confirmed - FleetTrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`, html }),
    });
    logStep("Confirmation email sent", { to: email });
  } catch (err) {
    logStep("Email error (non-blocking)", { error: String(err) });
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Plan mapping
const STRIPE_PLANS = {
  basic: "price_1T7YNEDrKSyvbr3II5UkdDEC", // $1.99/month
  pro: "price_1T7YNWDrKSyvbr3Is592GI1W", // $3.99/month
};

const TRIAL_DAYS = 7;

const safeDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logStep("Unauthorized request - missing bearer token");
      return new Response(JSON.stringify({ error: "Unauthorized. Please log in first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === "undefined" || token === "null") {
      logStep("Unauthorized request - invalid bearer token");
      return new Response(JSON.stringify({ error: "Unauthorized. Please log in first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      logStep("Authentication failed", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized. Please log in first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user profile to check trial status
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("trial_started_at, subscription_status, subscription_plan, subscription_end_at, payment_provider")
      .eq("id", user.id)
      .single();

    if (profileError) {
      logStep("Profile error", { error: profileError.message });
    }

    // Start trial on first login if not started
    let trialStartedAt = profile?.trial_started_at;
    if (!trialStartedAt) {
      trialStartedAt = new Date().toISOString();
      await supabaseClient
        .from("profiles")
        .update({ 
          trial_started_at: trialStartedAt,
          subscription_status: "trial"
        })
        .eq("id", user.id);
      logStep("Trial started", { trialStartedAt });
    }

    // Calculate trial expiry (with safe parsing)
    const trialDate = safeDate(trialStartedAt);
    if (!trialDate) {
      logStep("WARNING: Invalid trial_started_at value", { trialStartedAt });
    }
    const trialEnd = trialDate ? new Date(trialDate.getTime()) : new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const now = new Date();
    const trialExpired = now > trialEnd;
    const trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    logStep("Trial status", { trialStartedAt, trialEnd: trialEnd.toISOString(), trialExpired, trialDaysRemaining });

    // If already has active subscription, validate the date first
    if (profile?.subscription_status === "active" && profile?.subscription_end_at) {
      const subEnd = safeDate(profile.subscription_end_at);
      if (!subEnd) {
        logStep("WARNING: Invalid subscription_end_at, skipping active check", { subscription_end_at: profile.subscription_end_at });
      } else if (subEnd > now) {
        logStep("Active subscription found", { plan: profile.subscription_plan, endAt: profile.subscription_end_at });
        return new Response(JSON.stringify({
          status: "active",
          plan: profile.subscription_plan,
          subscription_end: profile.subscription_end_at,
          payment_provider: profile.payment_provider,
          trial_days_remaining: 0,
          trial_expired: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Check Stripe for active subscription
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
          const priceId = subscription.items.data[0]?.price.id;
          
          // Determine plan from price ID
          let plan = "pro";
          if (priceId === STRIPE_PLANS.basic) {
            plan = "basic";
          }

          // Update profile with subscription info
          await supabaseClient
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_plan: plan,
              subscription_end_at: subscriptionEnd,
              payment_provider: "stripe",
            })
            .eq("id", user.id);

          // Send confirmation email only when status transitions to active
          if (profile?.subscription_status !== "active") {
            await sendPaymentConfirmationEmail(user.email, plan, subscriptionEnd, "stripe");
          }

          logStep("Stripe subscription found", { plan, subscriptionEnd });

          return new Response(JSON.stringify({
            status: "active",
            plan,
            subscription_end: subscriptionEnd,
            payment_provider: "stripe",
            trial_days_remaining: 0,
            trial_expired: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // Check Paystack for active subscription (simplified - would need webhook for full implementation)
    // For now, rely on profile data that would be updated via webhook

    // Return trial status if no active subscription
    const status = trialExpired ? "expired" : "trial";
    
    // Update profile if trial expired
    if (trialExpired && profile?.subscription_status !== "expired") {
      await supabaseClient
        .from("profiles")
        .update({ subscription_status: "expired" })
        .eq("id", user.id);
    }

    logStep("Returning trial/expired status", { status, trialDaysRemaining });

    return new Response(JSON.stringify({
      status,
      plan: null,
      subscription_end: null,
      payment_provider: null,
      trial_days_remaining: trialDaysRemaining,
      trial_expired: trialExpired,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
