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
      headers: {
        Authorization: `Bearer ${paystackKey}`,
      },
    });

    const verifyData = await verifyRes.json();
    logStep("Paystack verification response", { status: verifyData.data?.status, amount: verifyData.data?.amount });

    if (!verifyData.status || verifyData.data?.status !== "success") {
      throw new Error("Payment not verified or not successful");
    }

    // Verify the email matches
    if (verifyData.data.customer?.email?.toLowerCase() !== user.email.toLowerCase()) {
      logStep("Email mismatch warning", { 
        paystack: verifyData.data.customer?.email, 
        user: user.email 
      });
    }

    // Determine plan from metadata or parameter
    const verifiedPlan = verifyData.data.metadata?.plan || plan || "basic";

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
