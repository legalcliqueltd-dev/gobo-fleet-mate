import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createHmac } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';

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
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b;">Paystack</td></tr>
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
      await sendEmail(email, `Payment Confirmed - FleetTrackMate ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
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
