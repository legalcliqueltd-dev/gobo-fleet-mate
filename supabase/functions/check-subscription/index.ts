import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
  basic: "price_basic_stripe", // Replace with actual Stripe price ID for Basic
  pro: "price_1RXr1bDRWKLOzMXaOq97Fnw4", // Existing Pro price
};

const TRIAL_DAYS = 7;

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
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
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

    // Calculate trial expiry
    const trialEnd = new Date(trialStartedAt);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const now = new Date();
    const trialExpired = now > trialEnd;
    const trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    logStep("Trial status", { trialStartedAt, trialEnd: trialEnd.toISOString(), trialExpired, trialDaysRemaining });

    // If already has active subscription, return that status
    if (profile?.subscription_status === "active" && profile?.subscription_end_at) {
      const subEnd = new Date(profile.subscription_end_at);
      if (subEnd > now) {
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
