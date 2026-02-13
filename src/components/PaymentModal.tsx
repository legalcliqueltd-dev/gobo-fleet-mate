import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, CreditCard, Building2, Loader2, Globe, MapPin, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Plan = "basic" | "pro";
type PaymentMethod = "paystack" | "stripe";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultPlan?: Plan;
}

const plans = {
  basic: {
    name: "Basic",
    priceUSD: "$1.99",
    priceNGN: "₦2,899",
    icon: Zap,
    features: [
      "1 driver connection",
      "Real-time GPS tracking",
      "Dashboard access",
      "Mobile driver app",
    ],
  },
  pro: {
    name: "Pro",
    priceUSD: "$3.99",
    priceNGN: "₦5,799",
    icon: Star,
    features: [
      "Unlimited driver connections",
      "Advanced analytics",
      "Priority support",
      "Push notifications",
      "Custom geofencing",
      "SOS emergency system",
    ],
  },
};

const PaymentModal = ({ open, onOpenChange, onSuccess, defaultPlan = "pro" }: PaymentModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(defaultPlan);
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
        onOpenChange(false);
        toast.success("Redirecting to payment page...");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-center">
            Unlock all features with a paid subscription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Selection */}
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(plans) as [Plan, typeof plans.basic][]).map(([key, plan]) => (
              <Card 
                key={key}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedPlan === key 
                    ? "border-2 border-primary bg-primary/5" 
                    : "border-2 border-border"
                }`}
                onClick={() => setSelectedPlan(key)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <plan.icon className={`w-4 h-4 ${selectedPlan === key ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-semibold">{plan.name}</span>
                    {key === "pro" && (
                      <Badge className="text-[10px] px-1 py-0">Popular</Badge>
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {selectedMethod === "paystack" ? plan.priceNGN : plan.priceUSD}
                    <span className="text-xs text-muted-foreground font-normal">/mo</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features */}
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {currentPlan.name} includes:
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {currentPlan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-success" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Select payment method:</p>
            
            <div className="grid grid-cols-2 gap-3">
              <Card 
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedMethod === "paystack" 
                    ? "border-2 border-primary bg-primary/5" 
                    : "border-2 border-border"
                }`}
                onClick={() => setSelectedMethod("paystack")}
              >
                <CardContent className="p-3 flex flex-col items-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-[#00C3F7]/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#00C3F7]" />
                  </div>
                  <span className="font-medium text-sm">Paystack</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-2.5 h-2.5" />
                    Nigeria
                  </div>
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
                <CardContent className="p-3 flex flex-col items-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-[#635BFF]/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-[#635BFF]" />
                  </div>
                  <span className="font-medium text-sm">Stripe</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Globe className="w-2.5 h-2.5" />
                    International
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pay Button */}
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full"
            onClick={handlePayment}
            disabled={loading || !selectedMethod}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Subscribe - {currentPrice}/month</>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3 text-success" />
              7 days free trial
            </div>
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3 text-success" />
              Cancel anytime
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
