import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYSTACK-CHECKOUT] ${step}${detailsStr}`);
};

// Paystack pricing (amount in kobo - 100 kobo = ₦1)
const PAYSTACK_PRICES = {
  basic: {
    amount: 289900, // ₦2,899/month
    name: "FleetTrackMate Basic",
  },
  pro: {
    amount: 579900, // ₦5,799/month
    name: "FleetTrackMate Pro",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Parse request body for plan selection
    const body = await req.json().catch(() => ({}));
    const plan = body.plan || "pro"; // Default to pro if not specified
    
    if (!["basic", "pro"].includes(plan)) {
      throw new Error("Invalid plan. Must be 'basic' or 'pro'");
    }

    const priceConfig = PAYSTACK_PRICES[plan as keyof typeof PAYSTACK_PRICES];
    logStep("Plan selected", { plan, amount: priceConfig.amount });

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) {
      throw new Error("Paystack secret key not configured. Please add PAYSTACK_SECRET_KEY to secrets.");
    }

    const origin = req.headers.get("origin") || "https://fleettrackmate.com";

    // Initialize Paystack transaction
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: priceConfig.amount,
        currency: "NGN",
        callback_url: `${origin}/dashboard?payment=success&plan=${plan}&provider=paystack`,
        metadata: {
          user_id: user.id,
          plan,
          custom_fields: [
            {
              display_name: "Plan",
              variable_name: "plan",
              value: priceConfig.name
            }
          ]
        }
      }),
    });

    const result = await response.json();

    if (!result.status) {
      throw new Error(result.message || "Failed to initialize Paystack transaction");
    }

    logStep("Paystack transaction initialized", { reference: result.data.reference, plan });

    return new Response(JSON.stringify({ 
      url: result.data.authorization_url,
      reference: result.data.reference 
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
