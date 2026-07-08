import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, Shield } from "lucide-react";
import PaymentModal from "@/components/PaymentModal";

const plans = [
  {
    name: "Basic",
    price: "$1.99",
    period: "/month",
    description: "For small teams getting started",
    features: [
      "Up to 2 driver connections",
      "Real-time GPS tracking",
      "Dashboard access",
      "Mobile driver app",
      "Basic analytics",
      "Email support",
    ],
    popular: false,
  },
  {
    name: "Pro",
    price: "$3.99",
    period: "/month",
    description: "For growing businesses",
    features: [
      "Unlimited driver connections",
      "Real-time GPS tracking",
      "Advanced analytics",
      "Priority support",
      "Push notifications",
      "Custom geofencing",
      "Trip history & reports",
      "SOS emergency system",
    ],
    popular: true,
  },
];

const steps = [
  {
    number: "01",
    title: "Sign up",
    description: "Create your account in seconds — no card needed.",
  },
  {
    number: "02",
    title: "Track free for 7 days",
    description: "Full admin access while you try it with your fleet.",
  },
  {
    number: "03",
    title: "Subscribe",
    description: "Keep the console from $1.99/month. Cancel anytime.",
  },
];

const Pricing = () => {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro">("pro");

  return (
    <>
      <PaymentModal open={paymentOpen} onOpenChange={setPaymentOpen} defaultPlan={selectedPlan} />
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow mb-4 justify-center">Pricing</p>
            <h2 className="mb-4 font-heading text-4xl font-bold tracking-tight md:text-5xl">
              Start free. Upgrade when ready.
            </h2>
            <p className="text-lg text-muted-foreground">
              Track your fleet free for 7 days — no credit card needed. Only the admin console
              requires a subscription; the driver app is always free.
            </p>
          </div>

          {/* How it works */}
          <div className="mx-auto mb-14 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="mb-3 font-mono text-sm font-medium text-primary">{step.number}</div>
                <h3 className="mb-1 font-heading text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Plans */}
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-xl border bg-card p-7 transition-all duration-200 ${
                  plan.popular
                    ? "border-primary shadow-lg shadow-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary-foreground">
                    Popular
                  </span>
                )}

                <div className="mb-6">
                  <h3 className="font-heading text-2xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="telemetry text-5xl font-semibold tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    <Check className="h-3 w-3" />7 days free
                  </span>
                </div>

                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto space-y-3">
                  <a href="/auth/signup" className="block">
                    <Button
                      variant={plan.popular ? "hero" : "default"}
                      size="lg"
                      className="w-full"
                    >
                      Start free trial
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedPlan(plan.name.toLowerCase() as "basic" | "pro");
                      setPaymentOpen(true);
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay now · skip trial
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Trust line */}
          <div className="mt-12 space-y-4 text-center">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["7-day free trial", "Cancel anytime", "Free driver app"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  {item}
                </span>
              ))}
            </div>
            <p className="mx-auto flex max-w-lg items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              No payment required for the trial. Subscription covers the admin console only — the
              driver app is always free.
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

export default Pricing;
