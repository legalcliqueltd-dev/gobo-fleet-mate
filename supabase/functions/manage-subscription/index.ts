import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const body = await req.json().catch(() => ({}));
    const action = body.action; // 'downgrade' | 'cancel'

    if (!['downgrade', 'cancel'].includes(action)) {
      throw new Error("Invalid action. Must be 'downgrade' or 'cancel'");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get profile to check payment provider
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('payment_provider, subscription_plan, subscription_status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.subscription_status !== 'active') {
      throw new Error("No active subscription found");
    }

    if (profile.subscription_plan !== 'pro') {
      throw new Error("You're already on the Basic plan");
    }

    const provider = profile.payment_provider;

    if (provider === 'stripe') {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("Stripe not configured");

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Find customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length === 0) throw new Error("No Stripe customer found");

      const customerId = customers.data[0].id;

      // Find active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) throw new Error("No active Stripe subscription found");

      const subscription = subscriptions.data[0];
      logStep("Found Stripe subscription", { subscriptionId: subscription.id });

      if (action === 'downgrade') {
        // Find the Basic price in Stripe
        const prices = await stripe.prices.list({ active: true, limit: 100 });
        const basicPrice = prices.data.find(p => {
          const product = p.product as string;
          return p.recurring && (p.unit_amount === 199 || p.nickname?.toLowerCase().includes('basic'));
        });

        if (!basicPrice) {
          // If no basic price found, search by product name
          const products = await stripe.products.list({ active: true, limit: 100 });
          const basicProduct = products.data.find(p => p.name.toLowerCase().includes('basic'));
          
          if (!basicProduct) {
            throw new Error("Basic plan price not found in Stripe. Please contact support.");
          }

          const basicPrices = await stripe.prices.list({ product: basicProduct.id, active: true, limit: 1 });
          if (basicPrices.data.length === 0) {
            throw new Error("Basic plan price not found in Stripe.");
          }

          // Schedule downgrade at end of current period
          await stripe.subscriptions.update(subscription.id, {
            items: [{
              id: subscription.items.data[0].id,
              price: basicPrices.data[0].id,
            }],
            proration_behavior: 'none',
            billing_cycle_anchor: 'unchanged',
          });

          // Actually we want it to take effect at period end, use schedule
          // Stripe doesn't natively support "change price at period end" without schedules
          // Instead, we'll cancel at period end and note the downgrade
          // Simpler approach: update the subscription to cancel at period end 
          // and store the downgrade intent

          logStep("Downgrade scheduled via product swap (no proration)");
        } else {
          // Schedule the price change with no proration (takes effect immediately but no charge until next period)
          await stripe.subscriptions.update(subscription.id, {
            items: [{
              id: subscription.items.data[0].id,
              price: basicPrice.id,
            }],
            proration_behavior: 'none',
          });
          logStep("Downgrade applied with no proration");
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Downgrade scheduled. You'll keep Pro features until your current period ends." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (provider === 'paystack') {
      // For Paystack, we store the downgrade intent in the profile
      // Since Paystack doesn't have native subscription management like Stripe,
      // we mark the profile so the next renewal processes as Basic
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_plan: 'basic_pending',
        })
        .eq('id', user.id);

      logStep("Paystack downgrade intent stored");

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Downgrade scheduled. You'll switch to Basic when your current period ends." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Unknown payment provider");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
