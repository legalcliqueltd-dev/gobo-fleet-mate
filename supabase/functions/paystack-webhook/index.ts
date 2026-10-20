import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { paymentConfirmedEmail } from '../_shared/email.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'TrackMate <noreply@fleettrackmate.com>';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAYSTACK-WEBHOOK] ${step}${detailsStr}`);
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { logStep("Skipping email - no RESEND_API_KEY"); return; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' } }),
    });
    const data = await res.json();
    logStep("Email sent", { id: data.id, to });
  } catch (err) { logStep("Email error", { error: String(err) }); }
}

function paymentConfirmationHtml(plan: string, amount: string, renewalDate: string, daysRemaining: number) {
  return paymentConfirmedEmail({ plan, amount, provider: 'Paystack', renewalDate, daysRemaining });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackKey) {
    logStep("ERROR: PAYSTACK_SECRET_KEY not set");
    return new Response("Server error", { status: 500 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    
    // Verify Paystack webhook signature
    const hash = req.headers.get("x-paystack-signature");
    if (hash) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(paystackKey), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (hash !== expected) {
        logStep("Invalid signature");
        return new Response("Invalid signature", { status: 400 });
      }
      logStep("Signature verified");
    } else {
      logStep("WARNING: No x-paystack-signature header");
    }

    const event = JSON.parse(body);
    logStep("Event received", { event: event.event, reference: event.data?.reference });

    if (event.event === "charge.success") {
      const data = event.data;
      const email = data.customer?.email;
      const reference = data.reference;
      const plan = data.metadata?.plan || "basic";
      const amountKobo = data.amount;
      const amount = `₦${(amountKobo / 100).toLocaleString()}`;

      if (!email) {
        logStep("No customer email in webhook data");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      logStep("Processing charge.success", { email, plan, amount, reference });

      // Find user by email
      const { data: users } = await supabaseClient.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === email);
      
      if (!user) {
        logStep("User not found for email", { email });
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Calculate subscription end (30 days)
      const subscriptionEnd = new Date();
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
      const driverLimit = plan === "pro" ? 999 : 3;

      // Update profile
      await supabaseClient.from("profiles").update({
        subscription_status: "active",
        subscription_plan: plan,
        subscription_end_at: subscriptionEnd.toISOString(),
        payment_provider: "paystack",
      }).eq("id", user.id);

      // Update admin_subscriptions
      await supabaseClient.from("admin_subscriptions").upsert({
        user_id: user.id,
        plan_name: plan,
        status: "active",
        driver_limit: driverLimit,
        current_period_start: new Date().toISOString(),
        current_period_end: subscriptionEnd.toISOString(),
        features: { max_drivers: driverLimit, advanced_analytics: plan === "pro", push_notifications: true },
      }, { onConflict: "user_id" });

      // Send confirmation email
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const daysRemaining = Math.ceil((subscriptionEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      await sendEmail(email, `Payment Confirmed - TrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
        paymentConfirmationHtml(plan, amount, fmt(subscriptionEnd), daysRemaining));

      logStep("Subscription activated via Paystack webhook", { userId: user.id, plan });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
