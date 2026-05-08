import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Bell, Info, Palette, MapPin, Battery, Settings as SettingsIcon, User, CreditCard, Crown, Calendar, CheckCircle2, Mail, Send, Loader2, Phone, AlertTriangle } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PaymentModal from '@/components/PaymentModal';
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

  // Emergency contact — one value applied to every device this admin owns.
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(true);
  const [emergencySaving, setEmergencySaving] = useState(false);
  const [adminConnectionCodes, setAdminConnectionCodes] = useState<string[]>([]);

  const loadEmergencyContact = async () => {
    if (!user) return;
    setEmergencyLoading(true);
    try {
      const { data: devices, error: devErr } = await supabase
        .from('devices')
        .select('connection_code')
        .eq('user_id', user.id);
      if (devErr) throw devErr;

      const codes = (devices ?? [])
        .map((d) => d.connection_code)
        .filter((c): c is string => typeof c === 'string' && c.length > 0);
      setAdminConnectionCodes(codes);

      if (codes.length === 0) {
        setEmergencyName('');
        setEmergencyPhone('');
        return;
      }

      const { data: contacts, error: ecErr } = await supabase
        .from('emergency_contacts')
        .select('contact_name, contact_phone')
        .in('admin_code', codes)
        .eq('is_active', true)
        .order('contact_type', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);
      if (ecErr) throw ecErr;

      const row = contacts?.[0];
      setEmergencyName(row?.contact_name ?? '');
      setEmergencyPhone(row?.contact_phone ?? '');
    } catch (err) {
      console.warn('Failed to load emergency contact:', err);
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleSaveEmergencyContact = async () => {
    if (!user) return;
    const phone = emergencyPhone.trim();
    if (!phone) {
      toast.error('Phone number is required');
      return;
    }
    if (adminConnectionCodes.length === 0) {
      toast.error('Add a device first, then set the emergency contact.');
      return;
    }

    setEmergencySaving(true);
    try {
      const name = emergencyName.trim() || 'Fleet Administrator';

      // Replace any existing 'admin' contacts on each of this admin's devices
      // with the new value. Delete-then-insert avoids relying on a particular
      // unique constraint shape in the existing schema.
      const { error: delErr } = await supabase
        .from('emergency_contacts')
        .delete()
        .in('admin_code', adminConnectionCodes)
        .eq('contact_type', 'admin');
      if (delErr) throw delErr;

      const rows = adminConnectionCodes.map((code) => ({
        admin_code: code,
        contact_name: name,
        contact_phone: phone,
        contact_type: 'admin',
        contact_role: 'Fleet Administrator',
        is_active: true,
      }));
      const { error: insErr } = await supabase.from('emergency_contacts').insert(rows);
      if (insErr) throw insErr;

      toast.success(`Emergency contact updated for ${rows.length} device${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save emergency contact';
      toast.error(message);
    } finally {
      setEmergencySaving(false);
    }
  };

  const handleClearEmergencyContact = async () => {
    if (!user || adminConnectionCodes.length === 0) return;
    setEmergencySaving(true);
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .in('admin_code', adminConnectionCodes)
        .eq('contact_type', 'admin');
      if (error) throw error;
      setEmergencyName('');
      setEmergencyPhone('');
      toast.success('Emergency contact cleared. Drivers will see "not set" until you save a new number.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear emergency contact';
      toast.error(message);
    } finally {
      setEmergencySaving(false);
    }
  };

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
    loadEmergencyContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

          {/* Send Invoice Emails (admin only) */}
          {subscription.status === 'active' && (
            <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Email Actions</p>
              </div>
              <p className="text-xs text-muted-foreground">Send invoice emails to all paid subscribers with their plan details and expiration date.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendInvoices}
                disabled={sendingInvoices}
              >
                {sendingInvoices ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Send Invoices to Paid Users</>
                )}
              </Button>
            </div>
          )}
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
            <div className="p-1.5 rounded-lg bg-destructive/20">
              <Phone className="h-4 w-4 text-destructive" />
            </div>
            <h3 className="font-heading font-semibold text-lg">Emergency Contact</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This number appears on every connected driver's SOS screen as the call-for-help button.
            One number applies to all devices on your account.
          </p>

          {emergencyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading current contact...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-name">Contact name</Label>
                  <Input
                    id="emergency-name"
                    placeholder="e.g. Dispatch Desk"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    disabled={emergencySaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-phone">Phone number</Label>
                  <Input
                    id="emergency-phone"
                    type="tel"
                    placeholder="+1 555 555 5555"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    disabled={emergencySaving}
                  />
                </div>
              </div>

              {adminConnectionCodes.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-warning flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Add a device first; the emergency contact attaches to each of your devices.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Will apply to {adminConnectionCodes.length} device{adminConnectionCodes.length === 1 ? '' : 's'}.
                  Drivers see updates within ~60 seconds.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSaveEmergencyContact}
                  disabled={emergencySaving || adminConnectionCodes.length === 0}
                >
                  {emergencySaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <>Save</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearEmergencyContact}
                  disabled={emergencySaving || (!emergencyName && !emergencyPhone)}
                >
                  Clear
                </Button>
              </div>
            </>
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
