import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Link2, Copy, Trash2, Clock, User, Plus, ExternalLink, History, AlertCircle } from 'lucide-react';
import { createTempShareLink } from '@/lib/tempShare';

type TempSession = {
  id: string;
  token: string;
  label: string | null;
  guest_nickname: string | null;
  status: string | null;
  expires_at: string;
  created_at: string | null;
  claimed_at: string | null;
  last_seen_at: string | null;
};

export default function TempTracking() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TempSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [hours, setHours] = useState('3');

  const fetchSessions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('temp_track_sessions')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    
    setCreating(true);
    try {
      const { url } = await createTempShareLink(user.id, parseInt(hours), label.trim() || undefined);
      await navigator.clipboard.writeText(url);
      toast.success('Link created and copied to clipboard!');
      setLabel('');
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create link');
    }
    setCreating(false);
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase
      .from('temp_track_sessions')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Session deleted');
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const deleteAllExpired = async () => {
    const expiredIds = sessions
      .filter(s => new Date(s.expires_at) < new Date() || s.status === 'stopped')
      .map(s => s.id);
    
    if (expiredIds.length === 0) {
      toast.info('No expired sessions to delete');
      return;
    }

    const { error } = await supabase
      .from('temp_track_sessions')
      .delete()
      .in('id', expiredIds);
    
    if (error) {
      toast.error('Failed to delete expired sessions');
    } else {
      toast.success(`Deleted ${expiredIds.length} expired session(s)`);
      setSessions(prev => prev.filter(s => !expiredIds.includes(s.id)));
    }
  };

  const getStatusBadge = (session: TempSession) => {
    const isExpired = new Date(session.expires_at) < new Date();
    if (session.status === 'stopped' || isExpired) {
      return <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">Expired</span>;
    }
    if (session.claimed_at) {
      return <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending</span>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Temporary Tracking Links</h1>
        <p className="text-muted-foreground mt-1">Generate temporary links for guest location sharing</p>
      </div>

      {/* Create New Link */}
      <Card className="bg-gradient-to-br from-card to-primary/5 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create New Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Delivery #123"
                className="border-2"
              />
            </div>
            <div className="space-y-2">
              <Label>Expires In</Label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="border-2">
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
            <div className="flex items-end">
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                <Link2 className="h-4 w-4 mr-2" />
                {creating ? 'Creating...' : 'Generate Link'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session History */}
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Link History
            <span className="text-sm font-normal text-muted-foreground ml-2">({sessions.length})</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={deleteAllExpired} className="border-2">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Expired
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No tracking links yet</p>
              <p className="text-sm mt-1">Create one above to share with guests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const isExpired = new Date(session.expires_at) < new Date() || session.status === 'stopped';
                return (
                  <div
                    key={session.id}
                    className={`rounded-xl border-2 p-4 transition-all ${
                      isExpired ? 'border-border bg-muted/30 opacity-60' : 'border-primary/20 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(session)}
                          {session.label && (
                            <span className="font-semibold truncate">{session.label}</span>
                          )}
                          {!session.label && (
                            <span className="text-muted-foreground text-sm">No label</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Guest
                            </div>
                            <div className="font-medium">{session.guest_nickname || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Created
                            </div>
                            <div className="font-medium">{formatDate(session.created_at)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Expires
                            </div>
                            <div className="font-medium">{formatDate(session.expires_at)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last Seen
                            </div>
                            <div className="font-medium">{formatDate(session.last_seen_at)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isExpired && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyLink(session.token)}
                              className="border-2"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/share/${session.token}`, '_blank')}
                              className="border-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSession(session.id)}
                          className="border-2 hover:bg-destructive/10 hover:border-destructive/50"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}