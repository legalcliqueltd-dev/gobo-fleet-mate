import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ConfirmDialog from '@/components/ConfirmDialog';

/**
 * Operator console. Not a customer surface.
 *
 * Reachable only by an account holding `platform_owner`, and the route guard
 * here is convenience rather than security: every privileged read and write
 * goes through the `platform-admin` edge function, which re-checks the role
 * server-side. Hiding the page would protect nothing on its own — that was
 * exactly the mistake behind the old bulk-email button.
 *
 * Deliberately absent from the native bundle: it is never imported by
 * NativeApp.tsx, so Rollup keeps it (and the plan/pricing strings it touches)
 * out of the iOS and Android builds.
 */

type Stats = {
  total: number;
  active: number;
  pro: number;
  basic: number;
  trial: number;
  expired: number;
  mrrUsd: number;
  signups7d: number;
  signups30d: number;
};

type PlatformUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_end_at: string | null;
  payment_provider: string | null;
  created_at: string | null;
};

async function callPlatform<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const { data, error } = await supabase.functions.invoke('platform-admin', {
    body: { action, ...body },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function PlatformConsole() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Plan grant
  const [target, setTarget] = useState<PlatformUser | null>(null);
  const [grantPlan, setGrantPlan] = useState<'basic' | 'pro'>('pro');
  const [grantStatus, setGrantStatus] = useState<'active' | 'trial' | 'expired'>('active');
  const [grantMonths, setGrantMonths] = useState('1');
  const [grantReason, setGrantReason] = useState('');
  const [granting, setGranting] = useState(false);

  // Bulk email
  const [audience, setAudience] = useState<'all' | 'trial' | 'paid' | 'expired'>('trial');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailText, setEmailText] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  // Access is decided by the same call that fetches the data, rather than by a
  // separate is_platform_owner() probe. One round trip instead of two, and —
  // more to the point — there is then no client-side check that could drift
  // out of agreement with the server-side one that actually enforces this.
  useEffect(() => {
    callPlatform<Stats>('stats')
      .then((s) => {
        setStats(s);
        setAllowed(true);
      })
      .catch((err) => {
        const denied = /owner access required|not signed in/i.test(
          err instanceof Error ? err.message : ''
        );
        if (!denied) toast.error(err instanceof Error ? err.message : 'Could not load stats.');
        setAllowed(false);
      });
  }, []);

  const loadUsers = useCallback(async (term: string) => {
    setLoadingUsers(true);
    try {
      const res = await callPlatform<{ users: PlatformUser[] }>('list-users', { search: term });
      setUsers(res.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load users.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (allowed !== true) return;
    loadUsers('');
  }, [allowed, loadUsers]);

  const handleGrant = async () => {
    if (!target) return;
    setGranting(true);
    try {
      await callPlatform('grant-plan', {
        userId: target.id,
        plan: grantPlan,
        status: grantStatus,
        months: Number(grantMonths),
        reason: grantReason,
      });
      toast.success(`${target.email} is now ${grantStatus} on ${grantPlan}.`);
      setTarget(null);
      setGrantReason('');
      loadUsers(search);
      callPlatform<Stats>('stats').then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the plan.');
    } finally {
      setGranting(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('bulk-email', {
        body: {
          filter: audience,
          subject: emailSubject || undefined,
          text: emailText || undefined,
        },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error) throw new Error(error.message);
      toast.success(`Sent ${data.sent}, failed ${data.failed}.`);
      setEmailSubject('');
      setEmailText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  if (allowed === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <ShieldCheck className="mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="font-heading text-xl font-bold">Not available</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This area is for platform operators.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/20 p-2.5">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold">Platform console</h1>
          <p className="text-muted-foreground">Operators only — every action here is logged.</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Accounts" value={String(stats.total)} hint={`+${stats.signups7d} this week`} />
          <StatTile label="Paying" value={String(stats.active)} hint={`${stats.pro} Pro · ${stats.basic} Basic`} />
          <StatTile label="On trial" value={String(stats.trial)} hint={`${stats.expired} expired`} />
          <StatTile
            label="MRR"
            value={`$${stats.mrrUsd.toFixed(2)}`}
            hint="List price — reconcile with the processor"
          />
        </div>
      )}

      {/* Users */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/20 p-1.5">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Accounts</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              loadUsers(search);
            }}
          >
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="outline" disabled={loadingUsers}>
              {loadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </form>

          <div className="divide-y divide-border rounded-lg border border-border">
            {users.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No accounts found.</p>
            )}
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.full_name || '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {u.subscription_status ?? 'unknown'}
                  {u.subscription_plan ? ` · ${u.subscription_plan}` : ''}
                </Badge>
                {u.payment_provider === 'manual' && (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">
                    granted
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTarget(u);
                    setGrantPlan((u.subscription_plan as 'basic' | 'pro') ?? 'pro');
                    setGrantStatus('active');
                  }}
                >
                  Change plan
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grant panel */}
      {target && (
        <Card className="border-2 border-primary/40">
          <CardHeader className="pb-3">
            <h2 className="font-heading text-lg font-semibold">
              Change plan — {target.email}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={grantPlan} onValueChange={(v) => setGrantPlan(v as 'basic' | 'pro')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={grantStatus} onValueChange={(v) => setGrantStatus(v as typeof grantStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Months</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={grantMonths}
                  onChange={(e) => setGrantMonths(e.target.value)}
                  disabled={grantStatus !== 'active'}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-reason">Reason (required — goes in the audit log)</Label>
              <Input
                id="grant-reason"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Paystack webhook never fired for invoice #1234"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGrant} disabled={granting || !grantReason.trim()}>
                {granting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying…</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Apply</>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk email */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/20 p-1.5">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Email subscribers</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">On trial</SelectItem>
                  <SelectItem value="paid">Paying (sends invoices)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="all">Everyone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Leave empty to use the built-in template"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-text">Message</Label>
            <textarea
              id="email-text"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={4}
              placeholder="Plain text. It is escaped and wrapped in the FleetTrackMate template — HTML is not accepted."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              HTML bodies are rejected by the backend on purpose: a caller-supplied body
              would make any future auth slip a phishing vector from our own domain.
            </p>
          </div>

          <Button onClick={() => setConfirmSend(true)} disabled={sending}>
            {sending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
            ) : (
              <><Mail className="mr-2 h-4 w-4" />Send</>
            )}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send this email?"
        description={`It goes to the "${audience}" audience and cannot be recalled.`}
        confirmLabel="Send"
        onConfirm={handleSend}
      />
    </div>
  );
}
