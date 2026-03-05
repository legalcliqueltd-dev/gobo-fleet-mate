import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Calendar, ArrowDown, Loader2, AlertTriangle, CreditCard, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { plans } from "@/components/PaymentWall";
import type { SubscriptionStatus } from "@/contexts/AuthContext";

interface ActivePlanViewProps {
  subscription: {
    status: SubscriptionStatus;
    plan: 'basic' | 'pro' | null;
    subscriptionEnd: string | null;
    paymentProvider: 'stripe' | 'paystack' | null;
    trialDaysRemaining: number;
    trialExpired: boolean;
  };
  onDismiss?: () => void;
  onRefresh: () => Promise<void>;
}

const ActivePlanView = ({ subscription, onDismiss, onRefresh }: ActivePlanViewProps) => {
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  const currentPlan = subscription.plan || 'pro';
  const planDetails = plans[currentPlan];
  const isPro = currentPlan === 'pro';
  const renewalDate = subscription.subscriptionEnd 
    ? new Date(subscription.subscriptionEnd) 
    : null;
  const formattedRenewal = renewalDate?.toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const handleDowngrade = async () => {
    setDowngradeLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'downgrade' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Downgrade scheduled! You'll switch to Basic when your current Pro period ends.");
      setShowDowngradeConfirm(false);
      await onRefresh();
    } catch (err) {
      console.error("Downgrade error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to schedule downgrade");
    } finally {
      setDowngradeLoading(false);
    }
  };

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="pt-8 pb-6 space-y-6">
        {/* Plan header */}
        <div className="text-center space-y-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isPro ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
            {isPro ? <Star className="w-8 h-8 text-amber-500" /> : <Zap className="w-8 h-8 text-primary" />}
          </div>
          <div>
            <Badge className={isPro ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : "bg-primary/20 text-primary border-primary/30"}>
              Active Plan
            </Badge>
          </div>
          <h2 className="text-2xl font-bold">{planDetails.name} Plan</h2>
          <p className="text-muted-foreground text-sm">
            You have full access to all {planDetails.name} features
          </p>
        </div>

        {/* Billing details */}
        <div className="space-y-3 bg-muted/30 rounded-xl p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Monthly charge</span>
            <span className="font-semibold">
              {subscription.paymentProvider === 'paystack' ? planDetails.priceNGN : planDetails.priceUSD}/month
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Payment provider</span>
            <div className="flex items-center gap-1.5">
              {subscription.paymentProvider === 'paystack' ? (
                <Building2 className="w-3.5 h-3.5 text-[#00C3F7]" />
              ) : (
                <CreditCard className="w-3.5 h-3.5 text-[#635BFF]" />
              )}
              <span className="font-medium capitalize">{subscription.paymentProvider || 'Stripe'}</span>
            </div>
          </div>
          {renewalDate && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Next renewal</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{formattedRenewal}</span>
              </div>
            </div>
          )}
        </div>

        {/* Features list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your features:</p>
          <div className="grid grid-cols-1 gap-1.5">
            {planDetails.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-success" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Downgrade option for Pro users */}
        {isPro && !showDowngradeConfirm && (
          <div className="pt-2 border-t border-border">
            <button 
              onClick={() => setShowDowngradeConfirm(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 w-full text-center"
            >
              Downgrade to Basic
            </button>
          </div>
        )}

        {/* Downgrade confirmation */}
        {isPro && showDowngradeConfirm && (
          <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Downgrade to Basic?</p>
                <p className="text-xs text-muted-foreground">
                  Your Pro features will remain active until <strong>{formattedRenewal || 'the end of your billing period'}</strong>. 
                  After that, you'll be switched to the Basic plan at {subscription.paymentProvider === 'paystack' ? plans.basic.priceNGN : plans.basic.priceUSD}/month.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li className="text-destructive">• Driver limit reduces to 3</li>
                  <li className="text-destructive">• No advanced analytics</li>
                  <li className="text-destructive">• No custom geofencing</li>
                  <li className="text-destructive">• No SOS emergency system</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowDowngradeConfirm(false)}
              >
                Keep Pro
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleDowngrade}
                disabled={downgradeLoading}
              >
                {downgradeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <ArrowDown className="w-4 h-4 mr-1" />
                )}
                Confirm Downgrade
              </Button>
            </div>
          </div>
        )}

        {/* Close button */}
        {onDismiss && (
          <Button variant="outline" onClick={onDismiss} className="w-full">
            Close
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivePlanView;
