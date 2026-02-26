import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, CreditCard, Shield, UserPlus, MapPin, Rocket } from "lucide-react";
import PaymentModal from "@/components/PaymentModal";

const Pricing = () => {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro">("pro");

  const plans = [
    {
      name: "Basic",
      price: "$1.99",
      period: "/month",
      description: "Perfect for small teams",
      features: [
        "Up to 2 driver connections",
        "Real-time GPS tracking",
        "Dashboard access",
        "Mobile driver app",
        "Basic analytics",
        "Email support",
      ],
      popular: false,
      icon: Zap,
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
      icon: Star,
    },
  ];

  const steps = [
    {
      icon: UserPlus,
      title: "Sign Up",
      description: "Create your account in seconds",
    },
    {
      icon: MapPin,
      title: "Track Free",
      description: "7 days full admin access",
    },
    {
      icon: Rocket,
      title: "Subscribe",
      description: "Continue from $1.99/month",
    },
  ];

  return (
    <>
      <PaymentModal open={paymentOpen} onOpenChange={setPaymentOpen} defaultPlan={selectedPlan} />
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">
              Pricing
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Start Free. Upgrade When Ready.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Track your fleet free for 7 days. No credit card needed. Only admin features require a subscription — driver app is always free.
            </p>
          </div>

          {/* How It Works - 3 Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-14">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative flex flex-col items-center text-center p-5 rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 mb-3">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-xs font-bold text-primary mb-1">Step {index + 1}</div>
                <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col ${
                  plan.popular
                    ? "border-2 border-primary shadow-lg shadow-primary/20"
                    : "border-2 border-border hover:shadow-lg"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${plan.popular ? 'bg-primary/20' : 'bg-muted'}`}>
                      <plan.icon className={`w-5 h-5 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-base">{plan.description}</CardDescription>

                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <Badge variant="outline" className="mt-2 border-success/50 text-success bg-success/10 w-fit">
                    7 days free
                  </Badge>
                </CardHeader>

                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <div className="w-5 h-5 bg-success/20 text-success rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3 mt-auto">
                    <a href="/auth/signup" className="block">
                      <Button
                        variant={plan.popular ? "hero" : "default"}
                        size="lg"
                        className="w-full text-base py-6"
                      >
                        Start Free Trial
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="default"
                      className="w-full"
                      onClick={() => {
                        setSelectedPlan(plan.name.toLowerCase() as "basic" | "pro");
                        setPaymentOpen(true);
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay Now · Skip Trial
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Footer Trust Badges */}
          <div className="text-center mt-12 space-y-4">
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>7 days free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>Free driver app</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              No payment required for 7-day trial. Payment only affects admin dashboard — driver app is always free.
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

export default Pricing;
