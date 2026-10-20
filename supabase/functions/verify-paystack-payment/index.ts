import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { paymentConfirmedEmail } from '../_shared/email.ts';
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
const FROM_EMAIL = 'TrackMate <noreply@fleettrackmate.com>';

async function sendPaymentConfirmationEmail(email: string, plan: string, expiryDate: Date, amount: string, provider: string) {
  if (!RESEND_API_KEY) {
    logStep("Skipping email - RESEND_API_KEY not set");
    return;
  }

  const formattedExpiry = expiryDate.toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const html = paymentConfirmedEmail({ plan, amount, provider, renewalDate: formattedExpiry, daysRemaining });

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
        subject: `Payment Confirmed - TrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
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
