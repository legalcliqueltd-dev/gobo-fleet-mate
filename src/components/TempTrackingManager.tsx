import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Link2, Copy, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

type TempSession = {
  id: string;
  token: string;
  label: string | null;
  expires_at: string;
  status: string;
  device_id: string | null;
  guest_nickname: string | null;
  claimed_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export default function TempTrackingManager() {
  const [sessions, setSessions] = useState<TempSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [expiryHours, setExpiryHours] = useState('3');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('temp_track_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load sessions:', error);
      return;
    }

    setSessions(data || []);
  };

  const generateLink = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiryHours));

      const { error } = await supabase.from('temp_track_sessions').insert({
        owner_user_id: user.id,
        token,
        label: label.trim() || null,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      const link = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(link);
      
      toast.success('Link generated and copied to clipboard!');
      setLabel('');
      setDialogOpen(false);
      loadSessions();
    } catch (err: any) {
      console.error('Failed to generate link:', err);
      toast.error('Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  const revokeSession = async (id: string) => {
    const { error } = await supabase
      .from('temp_track_sessions')
      .update({ status: 'revoked' })
      .eq('id', id);

    if (error) {
      console.error('Failed to revoke session:', error);
      toast.error('Failed to revoke session');
      return;
    }

    toast.success('Session revoked');
    loadSessions();
  };

  const getStatusBadge = (session: TempSession) => {
    const isExpired = new Date(session.expires_at) < new Date();
    const status = isExpired ? 'expired' : session.status;

    const colors = {
      active: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      claimed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      expired: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      revoked: 'bg-red-500/10 text-red-600 dark:text-red-400',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors] || colors.active}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Temporary Tracking Links</h2>
          <p className="text-sm text-muted-foreground">
            Generate temporary links for guest location sharing
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Link2 className="h-4 w-4 mr-2" />
              Generate Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Tracking Link</DialogTitle>
              <DialogDescription>
                Create a temporary link for someone to share their location with you
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label (Optional)</Label>
                <Input
                  id="label"
                  placeholder="e.g., Delivery Driver, Contractor #3"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry">Expires In</Label>
                <Select value={expiryHours} onValueChange={setExpiryHours}>
                  <SelectTrigger id="expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="3">3 hours</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generateLink} disabled={loading} className="w-full">
                {loading ? 'Generating...' : 'Generate & Copy Link'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No tracking links yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Generate a link to let someone share their location temporarily
            </p>
          </Card>
        ) : (
          sessions.map((session) => {
            const isExpired = new Date(session.expires_at) < new Date();
            const isActive = session.status === 'claimed' && !isExpired;

            return (
              <Card key={session.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(session)}
                      {session.guest_nickname && (
                        <span className="text-sm font-medium">
                          {session.guest_nickname}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {session.label || 'Unnamed Guest'}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-1 mt-1">
                      <p>Expires: {format(new Date(session.expires_at), 'MMM d, h:mm a')}</p>
                      {session.last_seen_at && (
                        <p>Last seen: {format(new Date(session.last_seen_at), 'MMM d, h:mm a')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isExpired && session.status !== 'revoked' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyLink(session.token)}
                        title="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => revokeSession(session.id)}
                        title="Revoke access"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Button variant="outline" size="sm" onClick={loadSessions}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  );
}
