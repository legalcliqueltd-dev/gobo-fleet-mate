import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Bell, Info, Palette, MapPin, Battery, Settings as SettingsIcon, User, CreditCard, Crown, Calendar, CheckCircle2, Mail, Send, Loader2 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import PaymentModal from '../components/PaymentModal';
import { toast } from 'sonner';

export default function Settings() {
  const { user, subscription } = useAuth();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sendingInvoices, setSendingInvoices] = useState(false);
  const [tokens, setTokens] = useState<{ id: string; token: string; platform: string; created_at: string }[]>([]);
  
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(() => {
    return localStorage.getItem('locationTrackingEnabled') !== 'false';
  });
  const [updateInterval, setUpdateInterval] = useState(() => {
    return localStorage.getItem('locationUpdateInterval') || '30000';
  });
  const [batterySavingMode, setBatterySavingMode] = useState(() => {
    return localStorage.getItem('batterySavingMode') === 'true';
  });

  const loadTokens = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notification_tokens')
      .select('id, token, platform, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setTokens(data ?? []);
  };

  useEffect(() => {
    loadTokens();
  }, [user]);

  const handleLocationTrackingToggle = (enabled: boolean) => {
    setLocationTrackingEnabled(enabled);
    localStorage.setItem('locationTrackingEnabled', String(enabled));
    toast.success(enabled ? 'Location tracking enabled' : 'Location tracking disabled');
    setTimeout(() => window.location.reload(), 500);
  };

  const handleUpdateIntervalChange = (value: string) => {
    setUpdateInterval(value);
    localStorage.setItem('locationUpdateInterval', value);
    toast.success('Update interval changed. Reload to apply.');
  };

  const handleSendInvoices = async () => {
    setSendingInvoices(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please log in first'); return; }
      
      const { data, error } = await supabase.functions.invoke('bulk-email', {
        body: { filter: 'paid' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (error) throw error;
      toast.success(`Invoices sent: ${data.sent} successful, ${data.failed} failed`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invoices');
    } finally {
      setSendingInvoices(false);
    }
  };

  const handleBatterySavingToggle = (enabled: boolean) => {
    setBatterySavingMode(enabled);
    localStorage.setItem('batterySavingMode', String(enabled));
    toast.success(enabled ? 'Battery saving mode enabled' : 'Battery saving mode disabled');
    setTimeout(() => window.location.reload(), 500);
  };

  const getIntervalLabel = (ms: string) => {
    switch (ms) {
      case '10000': return '10 seconds';
      case '30000': return '30 seconds';
      case '60000': return '1 minute';
      case '300000': return '5 minutes';
      default: return '30 seconds';
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/20">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      {/* Billing & Subscription */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-lg">Billing & Subscription</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2">
                {subscription.status === 'active' && subscription.plan ? (
                  <>
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-lg">{subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}</span>
                    <Badge className="bg-success/20 text-success border-success/30" variant="outline">Active</Badge>
                  </>
                ) : subscription.status === 'trial' && !subscription.trialExpired ? (
                  <>
                    <span className="font-semibold text-lg">Free Trial</span>
                    <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">
                      {subscription.trialDaysRemaining} days left
                    </Badge>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-lg">No Active Plan</span>
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30" variant="outline">Expired</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Subscription details */}
          {subscription.status === 'active' && subscription.subscriptionEnd && (
            <div className="rounded-lg bg-muted/50 border p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Next Renewal</span>
                </div>
                <span className="font-semibold">
                  {new Date(subscription.subscriptionEnd).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Payment Provider</span>
                </div>
                <span className="font-semibold capitalize">{subscription.paymentProvider || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span>Amount</span>
                </div>
                <span className="font-semibold">
                  {subscription.plan === 'pro' ? '$3.99/mo' : '$1.99/mo'}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {subscription.status === 'active' && subscription.plan === 'pro' ? (
              <p className="text-sm text-muted-foreground">You have the highest plan. No upgrades available.</p>
            ) : subscription.status === 'active' && subscription.plan === 'basic' ? (
              <Button variant="default" onClick={() => setShowPaymentModal(true)}>
                Upgrade to Pro
              </Button>
            ) : (
              <Button variant="default" onClick={() => setShowPaymentModal(true)}>
                Subscribe Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentModal open={showPaymentModal} onOpenChange={setShowPaymentModal} />

      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-lg">Location Tracking</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="location-tracking" className="font-medium">Enable Location Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Continuously track your location for fleet monitoring
              </p>
            </div>
            <Switch
              id="location-tracking"
              checked={locationTrackingEnabled}
              onCheckedChange={handleLocationTrackingToggle}
            />
          </div>

          {locationTrackingEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="update-interval" className="font-medium">Update Frequency</Label>
                <Select value={updateInterval} onValueChange={handleUpdateIntervalChange}>
                  <SelectTrigger id="update-interval" className="bg-background">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="10000">Every 10 seconds</SelectItem>
                    <SelectItem value="30000">Every 30 seconds</SelectItem>
                    <SelectItem value="60000">Every 1 minute</SelectItem>
                    <SelectItem value="300000">Every 5 minutes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Current: {getIntervalLabel(updateInterval)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Battery className="h-4 w-4 text-warning" />
                    <Label htmlFor="battery-saving" className="font-medium">Battery Saving Mode</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reduces tracking frequency when battery is low
                  </p>
                </div>
                <Switch
                  id="battery-saving"
                  checked={batterySavingMode}
                  onCheckedChange={handleBatterySavingToggle}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-lg">Appearance</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-lg">Notifications</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">In-App Notifications Enabled</p>
                <p className="text-sm text-muted-foreground">
                  You're receiving real-time in-app notifications for geofence events and driver updates.
                </p>
              </div>
            </div>
          </div>

          {tokens.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Previous tokens</div>
              <ul className="text-sm space-y-2">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{t.platform}</span>
                    <span>•</span>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-lg">Account</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage your email and password from the Supabase Auth dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
