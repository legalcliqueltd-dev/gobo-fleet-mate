import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, UserPlus, Mail, Phone, MapPin, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type DriverConnection = {
  id: string;
  driver_user_id: string;
  status: string;
  connected_at: string | null;
  invited_at: string | null;
  driver_email?: string;
  driver_name?: string;
};

type Subscription = {
  driver_limit: number;
  plan_name: string;
};

export default function DriversManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [drivers, setDrivers] = useState<DriverConnection[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteDriverId, setDeleteDriverId] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
    loadDrivers();
    loadSubscription();
    
    // Real-time subscription
    const channel = supabase
      .channel('admin-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_connections' }, loadDrivers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdminAccess = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!data) {
      toast.error('Admin access required');
      navigate('/dashboard');
    }
  };

  const loadDrivers = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data: connections } = await supabase
      .from('driver_connections')
      .select('*')
      .eq('admin_user_id', user.id)
      .order('created_at', { ascending: false });

    if (connections) {
      // Get driver profiles
      const driverIds = connections.map(c => c.driver_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', driverIds);

      // Merge data
      const driversWithProfiles = connections.map(conn => ({
        ...conn,
        driver_email: profiles?.find(p => p.id === conn.driver_user_id)?.email,
        driver_name: profiles?.find(p => p.id === conn.driver_user_id)?.full_name,
      }));

      setDrivers(driversWithProfiles);
    }
    
    setLoading(false);
  };

  const loadSubscription = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('admin_subscriptions')
      .select('driver_limit, plan_name')
      .eq('user_id', user.id)
      .maybeSingle();

    setSubscription(data || { driver_limit: 3, plan_name: 'free' });
  };

  const handleInviteDriver = async () => {
    if (!user || !inviteEmail.trim()) {
      toast.error('Please enter a valid email');
      return;
    }

    // Check driver limit
    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const limit = subscription?.driver_limit || 3;

    if (activeDrivers >= limit) {
      setUpgradeDialogOpen(true);
      return;
    }

    try {
      // Check if user exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim())
        .maybeSingle();

      if (!profile) {
        toast.error('User not found. They must sign up first.');
        return;
      }

      // Check if already connected
      const existing = drivers.find(d => d.driver_user_id === profile.id);
      if (existing) {
        toast.error('Driver already connected');
        return;
      }

      // Create connection
      const { error } = await supabase
        .from('driver_connections')
        .insert({
          admin_user_id: user.id,
          driver_user_id: profile.id,
          status: 'active',
          connected_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Driver connected successfully');
      setInviteEmail('');
      setInviteDialogOpen(false);
      loadDrivers();
    } catch (error: any) {
      console.error('Error inviting driver:', error);
      toast.error(error.message || 'Failed to connect driver');
    }
  };

  const handleRemoveDriver = async (driverId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('driver_connections')
        .update({ status: 'removed' })
        .eq('id', driverId)
        .eq('admin_user_id', user.id);

      if (error) throw error;

      toast.success('Driver removed');
      setDeleteDriverId(null);
      loadDrivers();
    } catch (error: any) {
      console.error('Error removing driver:', error);
      toast.error('Failed to remove driver');
    }
  };

  const activeDriverCount = drivers.filter(d => d.status === 'active').length;
  const driverLimit = subscription?.driver_limit || 3;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Driver Management</h1>
          <p className="text-muted-foreground mt-1">
            {activeDriverCount} of {driverLimit} drivers • {subscription?.plan_name || 'Free'} Plan
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setInviteDialogOpen(true)}
          disabled={activeDriverCount >= driverLimit}
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Add Driver
        </Button>
      </div>

      {activeDriverCount >= driverLimit && (
        <Card variant="glass" className="mb-6 border-amber-500/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Driver Limit Reached</p>
              <p className="text-sm text-muted-foreground">
                You've reached your plan's driver limit ({driverLimit}). Upgrade to connect more drivers.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUpgradeDialogOpen(true)}
            >
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Drivers List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading drivers...</p>
      ) : drivers.length === 0 ? (
        <Card variant="glass">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Drivers Connected</h3>
            <p className="text-muted-foreground mb-4">
              Get started by inviting your first driver to the platform
            </p>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-5 w-5 mr-2" />
              Invite Driver
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <Card key={driver.id} variant="glass">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {driver.driver_name || 'Driver'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {driver.driver_email}
                    </p>
                  </div>
                  <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                    {driver.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {driver.connected_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Connected {new Date(driver.connected_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/admin/drivers/${driver.driver_user_id}`)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteDriverId(driver.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Driver</DialogTitle>
            <DialogDescription>
              Enter the email address of the driver you want to connect. They must already have an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Driver Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteDriver}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDriverId} onOpenChange={() => setDeleteDriverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Driver?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the driver from your account. Their tasks will remain but you won't be able to track them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDriverId && handleRemoveDriver(deleteDriverId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>
              You've reached the maximum number of drivers for your current plan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm mb-4">
              Upgrade to our Pro plan to connect up to 10 drivers, or Business plan for unlimited drivers.
            </p>
            <div className="space-y-2">
              <Card variant="glass">
                <CardContent className="p-4">
                  <h4 className="font-semibold">Pro Plan - $29/month</h4>
                  <p className="text-sm text-muted-foreground">Up to 10 drivers</p>
                </CardContent>
              </Card>
              <Card variant="glass">
                <CardContent className="p-4">
                  <h4 className="font-semibold">Business Plan - $99/month</h4>
                  <p className="text-sm text-muted-foreground">Unlimited drivers</p>
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Maybe Later
            </Button>
            <Button onClick={() => navigate('/admin/subscription')}>
              Upgrade Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
