import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYSTACK] ${step}${detailsStr}`);
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';

async function sendPaymentConfirmationEmail(email: string, plan: string, expiryDate: Date, amount: string, provider: string) {
  if (!RESEND_API_KEY) {
    logStep("Skipping email - RESEND_API_KEY not set");
    return;
  }

  const formattedExpiry = expiryDate.toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e293b;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">FleetTrackMate</h1>
      </div>
      <div style="padding:24px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:56px;height:56px;background:#22c55e;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-size:28px;">&#10003;</span>
          </div>
          <h2 style="margin:0;color:#1e293b;font-size:22px;">Payment Confirmed</h2>
        </div>
        <div style="color:#475569;font-size:14px;line-height:1.6;">
          <p>Your subscription has been activated successfully. Here are your details:</p>
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${plan.charAt(0).toUpperCase() + plan.slice(1)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Amount Paid</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${amount}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${provider.charAt(0).toUpperCase() + provider.slice(1)}</td></tr>
              <tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px 0 6px;color:#64748b;font-size:13px;">Next Renewal</td><td style="padding:8px 0 6px;text-align:right;font-weight:600;color:#1e293b;">${formattedExpiry}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Days Remaining</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#22c55e;">${daysRemaining} days</td></tr>
            </table>
          </div>
          <p>You now have full access to all ${plan === 'pro' ? 'Pro' : 'Basic'} features including ${plan === 'pro' ? 'unlimited drivers, advanced analytics, geofencing, and SOS alerts' : 'up to 3 drivers, real-time GPS tracking, and dashboard access'}.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://fleettrackmate.com/dashboard" style="background-color:#2563eb;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Go to Dashboard</a>
        </div>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you subscribed to FleetTrackMate. Manage your subscription from your dashboard settings.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Payment Confirmed - FleetTrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
        html,
        headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' },
      }),
    });
    const data = await res.json();
    logStep("Confirmation email sent", { id: data.id, to: email });
  } catch (err) {
    logStep("Email send error (non-blocking)", { error: String(err) });
  }
}

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
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body = await req.json().catch(() => ({}));
    const { reference, plan } = body;

    if (!reference) throw new Error("Payment reference is required");
    logStep("Verifying reference", { reference, plan });

    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) throw new Error("Paystack secret key not configured");

    // Verify transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });

    const verifyData = await verifyRes.json();
    logStep("Paystack verification response", { status: verifyData.data?.status, amount: verifyData.data?.amount });

    if (!verifyData.status || verifyData.data?.status !== "success") {
      throw new Error("Payment not verified or not successful");
    }

    // Determine plan from metadata or parameter
    const verifiedPlan = verifyData.data.metadata?.plan || plan || "basic";
    const amountPaid = `₦${(verifyData.data.amount / 100).toLocaleString()}`;

    // Calculate subscription end (30 days from now)
    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

    // Update user profile with active subscription
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        subscription_status: "active",
        subscription_plan: verifiedPlan,
        subscription_end_at: subscriptionEnd.toISOString(),
        payment_provider: "paystack",
      })
      .eq("id", user.id);

    if (updateError) {
      logStep("Profile update error", { error: updateError.message });
      throw new Error("Failed to activate subscription");
    }

    // Also update admin_subscriptions table
    const driverLimit = verifiedPlan === "pro" ? 999 : 3;
    await supabaseClient
      .from("admin_subscriptions")
      .upsert({
        user_id: user.id,
        plan_name: verifiedPlan,
        status: "active",
        driver_limit: driverLimit,
        current_period_start: new Date().toISOString(),
        current_period_end: subscriptionEnd.toISOString(),
        features: {
          max_drivers: driverLimit,
          advanced_analytics: verifiedPlan === "pro",
          push_notifications: true,
        },
      }, { onConflict: "user_id" });

    logStep("Subscription activated", { plan: verifiedPlan, endAt: subscriptionEnd.toISOString() });

    // Send payment confirmation email (non-blocking)
    await sendPaymentConfirmationEmail(user.email, verifiedPlan, subscriptionEnd, amountPaid, "paystack");

    return new Response(JSON.stringify({
      status: "active",
      plan: verifiedPlan,
      subscription_end: subscriptionEnd.toISOString(),
      payment_provider: "paystack",
      trial_days_remaining: 0,
      trial_expired: false,
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
