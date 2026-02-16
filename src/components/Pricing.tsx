import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, CreditCard, Shield } from "lucide-react";
import { motion } from "framer-motion";
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
      trial: "7 days free",
      features: [
        "Up to 3 driver connections",
        "Real-time GPS tracking",
        "Dashboard access",
        "Mobile driver app",
        "Basic analytics",
        "Email support",
      ],
      cta: "Start Free Trial",
      href: "/auth/signup",
      popular: false,
      icon: Zap,
    },
    {
      name: "Pro",
      price: "$3.99",
      period: "/month",
      description: "For growing businesses",
      trial: "7 days free",
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
      cta: "Start Free Trial",
      href: "/auth/signup",
      popular: true,
      icon: Star,
    },
  ];

  return (
    <>
    <PaymentModal open={paymentOpen} onOpenChange={setPaymentOpen} defaultPlan={selectedPlan} />
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Try free for 7 days. No credit card required. Upgrade anytime.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              <Card 
                className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-2 h-full flex flex-col ${
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
                  {plan.trial && (
                    <Badge variant="outline" className="mt-2 border-success/50 text-success bg-success/10">
                      {plan.trial}
                    </Badge>
                  )}
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
                    <a href={plan.href} className="block">
                      <Button 
                        variant={plan.popular ? "hero" : "default"} 
                        size="lg" 
                        className="w-full text-base py-6"
                      >
                        {plan.cta}
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
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12 space-y-4"
        >
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
        </motion.div>
      </div>
    </section>
    </>
  );
};

export default Pricing;
