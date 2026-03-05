import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';

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
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">FleetTrackMate</h1></div>
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
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${amount}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">Stripe</td></tr>
              <tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px 0 6px;color:#64748b;font-size:13px;">Next Renewal</td><td style="padding:8px 0 6px;text-align:right;font-weight:600;color:#1e293b;">${renewalDate}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Days Remaining</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#22c55e;">${daysRemaining} days</td></tr>
            </table>
          </div>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://fleettrackmate.com/dashboard" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Go to Dashboard</a>
        </div>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">Manage your subscription from your dashboard settings.</p></div>
    </div>
  </div>
</body></html>`;
}

function trialStartedHtml(plan: string, trialEndDate: string, chargeDate: string, amount: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">FleetTrackMate</h1></div>
      <div style="padding:24px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:56px;height:56px;background:#3b82f6;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:28px;">&#128640;</span></div>
          <h2 style="margin:0;color:#1e293b;font-size:22px;">Your Free Trial Has Started</h2>
        </div>
        <div style="color:#475569;font-size:14px;line-height:1.6;">
          <p>Welcome to FleetTrackMate! Your 7-day free trial is now active. You have full access to all ${plan.charAt(0).toUpperCase() + plan.slice(1)} features.</p>
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">${plan.charAt(0).toUpperCase() + plan.slice(1)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Trial Ends</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#f59e0b;">${trialEndDate}</td></tr>
              <tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px 0 6px;color:#64748b;font-size:13px;">First Charge</td><td style="padding:8px 0 6px;text-align:right;font-weight:600;color:#1e293b;">${amount} on ${chargeDate}</td></tr>
            </table>
          </div>
          <p>You won't be charged until your trial ends. Cancel anytime from your dashboard settings.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://fleettrackmate.com/dashboard" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Go to Dashboard</a>
        </div>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">Manage your subscription from your dashboard settings.</p></div>
    </div>
  </div>
</body></html>`;
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
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
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
          await sendEmail(customerEmail, `Welcome to FleetTrackMate - Your Free Trial Has Started`, 
            trialStartedHtml(plan, fmt(trialEnd), fmt(trialEnd), amount));
        } else {
          const amount = plan === "pro" ? "$3.99/month" : "$1.99/month";
          const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const daysRemaining = Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          await sendEmail(customerEmail, `Payment Confirmed - FleetTrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
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
          await sendEmail(customerEmail, `Payment Confirmed - FleetTrackMate Renewal`,
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
          const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">FleetTrackMate</h1></div>
      <div style="padding:24px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:56px;height:56px;background:#f59e0b;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:28px;">&#9200;</span></div>
          <h2 style="margin:0;color:#1e293b;font-size:22px;">Your Trial Ends Soon</h2>
        </div>
        <div style="color:#475569;font-size:14px;line-height:1.6;">
          <p>Your free trial for FleetTrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} ends on <strong>${fmt(trialEnd)}</strong>.</p>
          <p>After that, you'll be charged <strong>${amount}/month</strong> to continue using all features.</p>
          <p>If you'd like to cancel, you can do so from your dashboard settings before your trial ends.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://fleettrackmate.com/settings" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Manage Subscription</a>
        </div>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you signed up for FleetTrackMate.</p></div>
    </div>
  </div>
</body></html>`;
          await sendEmail(customer.email, `Your FleetTrackMate Trial Ends Soon - ${amount}/month starts ${fmt(trialEnd)}`, html);
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
