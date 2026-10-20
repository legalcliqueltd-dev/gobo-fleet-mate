import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { brandEmail, paymentConfirmedEmail, trialStartedEmail } from '../_shared/email.ts';
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'TrackMate <noreply@fleettrackmate.com>';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const STRIPE_PLANS: Record<string, string> = {
  "price_1T7YNEDrKSyvbr3II5UkdDEC": "basic",
  "price_1T7YNWDrKSyvbr3Is592GI1W": "pro",
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
  return paymentConfirmedEmail({ plan, amount, provider: 'Stripe', renewalDate, daysRemaining });
}

function trialStartedHtml(plan: string, trialEndDate: string, chargeDate: string, amount: string) {
  return trialStartedEmail({ plan, trialEndDate, chargeDate, amount });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!stripeKey) {
    logStep("ERROR: STRIPE_SECRET_KEY not set");
    return new Response("Server error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const sig = req.headers.get("stripe-signature");
      if (!sig) {
        logStep("Missing stripe-signature header");
        return new Response("Missing signature", { status: 400 });
      }
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } else {
      // Without webhook secret, parse directly (less secure, but functional)
      event = JSON.parse(body);
      logStep("WARNING: No STRIPE_WEBHOOK_SECRET - processing without signature verification");
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const subscriptionId = session.subscription as string;
        
        if (!customerEmail || !subscriptionId) {
          logStep("Missing email or subscription", { customerEmail, subscriptionId });
          break;
        }

        // Get subscription details
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price.id;
        const plan = STRIPE_PLANS[priceId] || "pro";
        const isTrialing = sub.status === "trialing";
        const periodEnd = new Date(sub.current_period_end * 1000);
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
        
        logStep("Checkout completed", { email: customerEmail, plan, isTrialing, subscriptionId });

        // Find user by email
        const { data: users } = await supabaseClient.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email === customerEmail);
        
        if (!user) {
          logStep("User not found for email", { email: customerEmail });
          break;
        }

        const subscriptionEnd = (isTrialing && trialEnd) ? trialEnd : periodEnd;
        const driverLimit = plan === "pro" ? 999 : 3;

        // Update profile
        await supabaseClient.from("profiles").update({
          subscription_status: isTrialing ? "trial" : "active",
          subscription_plan: plan,
          subscription_end_at: subscriptionEnd.toISOString(),
          payment_provider: "stripe",
        }).eq("id", user.id);

        // Update admin_subscriptions
        await supabaseClient.from("admin_subscriptions").upsert({
          user_id: user.id,
          plan_name: plan,
          status: isTrialing ? "trialing" : "active",
          driver_limit: driverLimit,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: periodEnd.toISOString(),
          features: { max_drivers: driverLimit, advanced_analytics: plan === "pro", push_notifications: true },
        }, { onConflict: "user_id" });

        // Send appropriate email
        if (isTrialing && trialEnd) {
          const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const amount = plan === "pro" ? "$3.99/month" : "$1.99/month";
          await sendEmail(customerEmail, `Welcome to TrackMate - Your Free Trial Has Started`, 
            trialStartedHtml(plan, fmt(trialEnd), fmt(trialEnd), amount));
        } else {
          const amount = plan === "pro" ? "$3.99/month" : "$1.99/month";
          const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          await sendEmail(customerEmail, `Payment Confirmed - TrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            paymentConfirmationHtml(plan, amount, fmt(periodEnd), daysRemaining));
        }

        logStep("Subscription activated via webhook", { userId: user.id, plan, isTrialing });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerEmail = invoice.customer_email;
        const subscriptionId = invoice.subscription as string;
        
        if (!customerEmail || !subscriptionId) break;
        
        // Only process renewal invoices (not the first one which checkout.session.completed handles)
        if (invoice.billing_reason === "subscription_cycle") {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = sub.items.data[0]?.price.id;
          const plan = STRIPE_PLANS[priceId] || "pro";
          const periodEnd = new Date(sub.current_period_end * 1000);

          const { data: users } = await supabaseClient.auth.admin.listUsers();
          const user = users?.users?.find(u => u.email === customerEmail);
          if (!user) break;

          // Renew subscription
          await supabaseClient.from("profiles").update({
            subscription_status: "active",
            subscription_plan: plan,
            subscription_end_at: periodEnd.toISOString(),
            payment_provider: "stripe",
          }).eq("id", user.id);

          await supabaseClient.from("admin_subscriptions").upsert({
            user_id: user.id,
            plan_name: plan,
            status: "active",
            current_period_end: periodEnd.toISOString(),
          }, { onConflict: "user_id" });

          const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const amount = plan === "pro" ? "$3.99" : "$1.99";
          const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          await sendEmail(customerEmail, `Payment Confirmed - TrackMate Renewal`,
            paymentConfirmationHtml(plan, amount, fmt(periodEnd), daysRemaining));

          logStep("Renewal processed", { userId: user.id, plan });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        
        if (!customer.email) break;

        const { data: users } = await supabaseClient.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email === customer.email);
        if (!user) break;

        await supabaseClient.from("profiles").update({
          subscription_status: "expired",
          subscription_plan: null,
        }).eq("id", user.id);

        await supabaseClient.from("admin_subscriptions").update({
          status: "cancelled",
        }).eq("user_id", user.id);

        logStep("Subscription cancelled", { userId: user.id });
        break;
      }

      case "customer.subscription.trial_will_end": {
        // Sent 3 days before trial ends
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        
        if (!customer.email) break;

        const priceId = sub.items.data[0]?.price.id;
        const plan = STRIPE_PLANS[priceId] || "pro";
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
        const amount = plan === "pro" ? "$3.99" : "$1.99";

        if (trialEnd) {
          const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
          const html = brandEmail({
            eyebrow: 'Free trial',
            tone: 'warning',
            title: 'Your trial ends soon.',
            preheader: `Your TrackMate ${planName} trial ends ${fmt(trialEnd)}.`,
            body: `<p style="margin:0 0 12px;">Your free trial of TrackMate ${planName} ends on <strong>${fmt(trialEnd)}</strong>.</p>
<p style="margin:0;">After that it continues at <strong>${amount}/month</strong>, with nothing to set up. If you'd rather stop, cancel from Settings before the trial ends.</p>`,
            cta: { url: 'https://fleettrackmate.com/settings', label: 'Manage subscription' },
            reason: "You're receiving this because you signed up for a TrackMate trial.",
          });
          await sendEmail(customer.email, `Your TrackMate Trial Ends Soon - ${amount}/month starts ${fmt(trialEnd)}`, html);
          logStep("Trial ending email sent", { email: customer.email, trialEnd: fmt(trialEnd) });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        
        if (!customer.email) break;

        const { data: users } = await supabaseClient.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email === customer.email);
        if (!user) {
          logStep("User not found for subscription update", { email: customer.email });
          break;
        }

        const priceId = sub.items.data[0]?.price.id;
        const plan = STRIPE_PLANS[priceId] || "pro";
        const periodEnd = new Date(sub.current_period_end * 1000);
        const driverLimit = plan === "pro" ? 999 : 3;
        const isActive = sub.status === "active" || sub.status === "trialing";

        if (isActive) {
          await supabaseClient.from("profiles").update({
            subscription_status: "active",
            subscription_plan: plan,
            subscription_end_at: periodEnd.toISOString(),
            payment_provider: "stripe",
          }).eq("id", user.id);

          await supabaseClient.from("admin_subscriptions").upsert({
            user_id: user.id,
            plan_name: plan,
            status: "active",
            driver_limit: driverLimit,
            stripe_subscription_id: sub.id,
            stripe_customer_id: customerId,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: periodEnd.toISOString(),
            features: { max_drivers: driverLimit, advanced_analytics: plan === "pro", push_notifications: true },
          }, { onConflict: "user_id" });

          logStep("Subscription updated (plan change)", { userId: user.id, plan, driverLimit });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
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
