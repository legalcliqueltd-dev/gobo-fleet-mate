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
import { Check, CreditCard, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const PaymentModal = ({ open, onOpenChange, onSuccess }: PaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<"paystack" | "stripe" | null>(null);
  const [loading, setLoading] = useState(false);

  const features = [
    "Unlimited driver connections",
    "Advanced analytics dashboard",
    "Priority customer support",
    "Push notifications",
    "Custom geofencing",
    "Trip history & reports",
  ];

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setLoading(true);

    try {
      const functionName = selectedMethod === "stripe" ? "create-checkout" : "create-paystack-checkout";
      
      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) {
        throw new Error(error.message || "Failed to create checkout session");
      }

      if (data?.url) {
        // Open checkout in new tab
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription className="text-center">
            Unlock unlimited drivers and premium features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Price */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">₦3,999</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <Badge variant="secondary" className="mt-2 bg-success/20 text-success border-success/30">
              Cancel anytime
            </Badge>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 gap-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-success" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
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
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[#00C3F7]/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#00C3F7]" />
                  </div>
                  <span className="font-medium text-sm">Paystack</span>
                  <span className="text-xs text-muted-foreground">Nigerian cards</span>
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
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[#635BFF]/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#635BFF]" />
                  </div>
                  <span className="font-medium text-sm">Stripe</span>
                  <span className="text-xs text-muted-foreground">International</span>
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
              <>Pay ₦3,999/month</>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By proceeding, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
