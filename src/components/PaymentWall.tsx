import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Building2, Loader2, Star, Zap, Globe, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Plan = "basic" | "pro";
type PaymentMethod = "stripe" | "paystack";

const plans = {
  basic: {
    name: "Basic",
    priceUSD: "$1.99",
    priceNGN: "₦1,499",
    period: "/month",
    icon: Zap,
    features: [
      "1 driver connection",
      "Real-time GPS tracking",
      "Dashboard access",
      "Mobile driver app",
      "Basic analytics",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    priceUSD: "$3.99",
    priceNGN: "₦3,999",
    period: "/month",
    icon: Star,
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
  },
};

interface PaymentWallProps {
  onDismiss?: () => void;
}

const PaymentWall = ({ onDismiss }: PaymentWallProps) => {
  const { subscription, refreshSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("pro");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setLoading(true);

    try {
      const functionName = selectedMethod === "stripe" ? "create-checkout" : "create-paystack-checkout";
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { plan: selectedPlan }
      });

      if (error) {
        throw new Error(error.message || "Failed to create checkout session");
      }

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to payment page...");
        
        // Refresh subscription after a delay (in case user completes payment quickly)
        setTimeout(() => {
          refreshSubscription();
        }, 5000);
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Payment failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = plans[selectedPlan];
  const currentPrice = selectedMethod === "paystack" ? currentPlan.priceNGN : currentPlan.priceUSD;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl my-8">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4 border-destructive/50 text-destructive bg-destructive/10">
            Trial Expired
          </Badge>
          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Your 7-day trial has ended. Subscribe to continue tracking your fleet.
          </p>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(Object.entries(plans) as [Plan, typeof plans.basic][]).map(([key, plan]) => (
            <Card 
              key={key}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                selectedPlan === key 
                  ? "border-2 border-primary shadow-lg shadow-primary/20" 
                  : "border-2 border-border"
              }`}
              onClick={() => setSelectedPlan(key)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${selectedPlan === key ? 'bg-primary/20' : 'bg-muted'}`}>
                      <plan.icon className={`w-5 h-5 ${selectedPlan === key ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  {key === "pro" && (
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold">
                    {selectedMethod === "paystack" ? plan.priceNGN : plan.priceUSD}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <div className="w-4 h-4 bg-success/20 text-success rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      {feature}
                    </li>
                  ))}
                  {plan.features.length > 4 && (
                    <li className="text-sm text-muted-foreground ml-6">
                      +{plan.features.length - 4} more features
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Method Selection */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Select Payment Method</CardTitle>
            <CardDescription>
              Choose based on your location for the best experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedMethod === "paystack" 
                    ? "border-2 border-primary bg-primary/5" 
                    : "border-2 border-border"
                }`}
                onClick={() => setSelectedMethod("paystack")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#00C3F7]/20 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-[#00C3F7]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Paystack</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        Recommended for Nigeria
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      {currentPlan.priceNGN}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pay with Nigerian cards, bank transfers, or USSD
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedMethod === "stripe" 
                    ? "border-2 border-primary bg-primary/5" 
                    : "border-2 border-border"
                }`}
                onClick={() => setSelectedMethod("stripe")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#635BFF]/20 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-[#635BFF]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Stripe</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Globe className="w-3 h-3" />
                        International payments
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      {currentPlan.priceUSD}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pay with Visa, Mastercard, or other international cards
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <div className="flex flex-col gap-4">
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full text-lg py-6"
            onClick={handlePayment}
            disabled={loading || !selectedMethod}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Subscribe to {currentPlan.name} - {currentPrice}/month
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By subscribing, you agree to our Terms of Service and Privacy Policy. 
            Cancel anytime from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentWall;
