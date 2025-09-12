import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star } from "lucide-react";
import { useState } from "react";

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  
  const plans = [
    {
      name: "Starter",
      monthlyPrice: 15,
      description: "Perfect for small fleets and startups",
      vehicles: "Up to 5 vehicles",
      features: [
        "Real-time GPS tracking",
        "Basic reporting",
        "Mobile app access",
        "Email support",
        "Route history (30 days)"
      ],
      popular: false
    },
    {
      name: "Professional",
      monthlyPrice: 45,
      description: "Ideal for growing businesses",
      vehicles: "Up to 25 vehicles",
      features: [
        "Everything in Starter",
        "Advanced analytics",
        "Route optimization",
        "Fuel management",
        "Driver behavior monitoring",
        "Maintenance alerts",
        "Priority support",
        "Route history (1 year)"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      monthlyPrice: 99,
      description: "For large fleets and enterprises",
      vehicles: "Unlimited vehicles",
      features: [
        "Everything in Professional",
        "Custom integrations",
        "Advanced security features",
        "White-label options",
        "24/7 phone support",
        "Dedicated account manager",
        "Custom reporting",
        "Unlimited history"
      ],
      popular: false
    }
  ];

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      return Math.round(monthlyPrice * 0.9); // 10% discount for annual
    }
    return monthlyPrice;
  };

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Choose the perfect plan for your fleet. All plans include free setup, 
            training, and 24/7 monitoring with no hidden fees.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm ${!isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isAnnual ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                  isAnnual ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge variant="secondary" className="ml-2 bg-success/20 text-success border-success/30">
                Save 10%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-2 ${
                plan.popular 
                  ? "border-primary shadow-lg shadow-primary/20 scale-105" 
                  : "hover:shadow-lg card-gradient"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    <Star className="w-4 h-4 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-base">{plan.description}</CardDescription>
                
                <div className="mt-4">
                  <span className="text-4xl font-bold">${getPrice(plan.monthlyPrice)}</span>
                  <span className="text-muted-foreground">/{isAnnual ? 'month' : 'month'}</span>
                  {isAnnual && (
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="line-through">${plan.monthlyPrice}</span> monthly
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground mt-2">{plan.vehicles}</p>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <div className="w-5 h-5 bg-success/20 text-success rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  variant={plan.popular ? "hero" : "outline"} 
                  size="lg" 
                  className="w-full"
                >
                  {plan.name === "Enterprise" ? "Contact Sales" : "Start Free Trial"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span>Free setup & training</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span>99.9% uptime guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;