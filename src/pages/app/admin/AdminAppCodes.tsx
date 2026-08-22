import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserX,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

type Device = {
  id: string;
  name: string | null;
  connection_code: string | null;
  created_at: string | null;
};

type Driver = {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  status: string | null;
  last_seen_at: string | null;
};

type Row = {
  device: Device;
  driver: Driver | null;
};

type PendingAction =
  | { kind: 'revoke'; row: Row }
  | { kind: 'newcode'; row: Row }
  | { kind: 'delete'; row: Row }
  | null;

/**
 * Connection codes — create, share, revoke, replace.
 *
 * The governing rule here is REVOKE, NEVER ERASE. A driver's visits, receipts
 * and expenses are evidence: his proof that he did the work, and the manager's
 * proof that it was done. Removing someone's access must not be able to delete
 * that, or an inconvenient record could be made to disappear by firing the
 * person who created it.
 *
 * So revoking locks the driver out and frees the vehicle for someone else,
 * while every record he produced stays exactly where it was. Deleting outright
 * is offered only for a code nobody ever used, where there is nothing to lose.
 */
export default function AdminAppCodes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('id, name, connection_code, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const codes = (devices ?? [])
        .map((d) => d.connection_code)
        .filter((c): c is string => Boolean(c));

      const { data: drivers } = codes.length
        ? await supabase
            .from('drivers')
            .select('driver_id, driver_name, admin_code, status, last_seen_at')
            .in('admin_code', codes)
        : { data: [] as Driver[] };

      const byCode = new Map((drivers ?? []).map((d) => [d.admin_code, d as Driver]));
      setRows(
        (devices ?? []).map((device) => ({
          device: device as Device,
          driver: device.connection_code ? byCode.get(device.connection_code) ?? null : null,
        }))
      );
    } catch (err) {
      console.error('[AdminAppCodes] load failed:', err);
      toast.error('Could not load your codes');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const { active, unclaimed } = useMemo(
    () => ({
      active: rows.filter((r) => r.driver && r.driver.status !== 'revoked'),
      unclaimed: rows.filter((r) => !r.driver || r.driver.status === 'revoked'),
    }),
    [rows]
  );

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const share = async (row: Row) => {
    const code = row.device.connection_code;
    if (!code) return;
    const text = `You have been added to ${row.device.name || 'the fleet'} on FleetTrackMate.\n\nYour connection code is: ${code}\n\nOpen FleetTrackMate, choose "I drive", and enter this code with your name.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FleetTrackMate', text });
      } catch {
        /* dismissed */
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  /**
   * Lock the driver out. Everything he recorded stays.
   *
   * The code is rotated in the same step, deliberately. Marking the driver
   * revoked without changing it would let him simply re-enter the same code
   * and walk back in, which makes the button a lie.
   */
  const revoke = async (row: Row) => {
    if (!row.driver) return;
    setBusyId(row.device.id);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'revoked' })
        .eq('driver_id', row.driver.driver_id);
      if (error) throw error;

      const { data: generated } = await supabase.rpc('generate_connection_code');
      if (generated) {
        await supabase
          .from('devices')
          .update({ connection_code: generated as string })
          .eq('id', row.device.id);
      }

      toast.success(`${row.driver.driver_name || 'Driver'} locked out`, {
        description: 'A fresh code is ready. Their history and receipts are kept.',
      });
      void load();
    } catch (err) {
      console.error('[AdminAppCodes] revoke failed:', err);
      toast.error('Could not revoke that driver');
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  /** Issue a fresh code for the same vehicle; the old one stops working. */
  const rotate = async (row: Row) => {
    setBusyId(row.device.id);
    try {
      const { data: generated, error: codeError } = await supabase.rpc('generate_connection_code');
      if (codeError || !generated) throw codeError ?? new Error('No code generated');

      const { error } = await supabase
        .from('devices')
        .update({ connection_code: generated as string })
        .eq('id', row.device.id);
      if (error) throw error;

      toast.success('New code issued', { description: 'The old code no longer works.' });
      void load();
    } catch (err) {
      console.error('[AdminAppCodes] rotate failed:', err);
      toast.error('Could not issue a new code');
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  /** Only ever offered for a code nobody has used. */
  const remove = async (row: Row) => {
    setBusyId(row.device.id);
    try {
      const { error } = await supabase.from('devices').delete().eq('id', row.device.id);
      if (error) throw error;
      toast.success('Code deleted');
      void load();
    } catch (err) {
      console.error('[AdminAppCodes] delete failed:', err);
      toast.error('Could not delete that code');
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  const renderRow = (row: Row) => {
    const code = row.device.connection_code;
    const claimed = Boolean(row.driver) && row.driver?.status !== 'revoked';
    const wasRevoked = row.driver?.status === 'revoked';
    const isRevealed = revealed.has(row.device.id);
    const busy = busyId === row.device.id;

    return (
      <li
        key={row.device.id}
        className="rounded-2xl border border-border bg-card p-4"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              claimed ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            )}
          >
            <KeyRound className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {row.device.name || 'Unnamed vehicle'}
            </p>
            <p className="text-xs text-muted-foreground">
              {claimed
                ? `${row.driver?.driver_name?.trim() || 'Driver'} · ${
                    row.driver?.last_seen_at
                      ? formatDistanceToNow(new Date(row.driver.last_seen_at), { addSuffix: true })
                      : 'not seen yet'
                  }`
                : wasRevoked
                  ? 'Access revoked — records kept'
                  : 'Waiting for a driver to join'}
            </p>
          </div>
        </div>

        {/* The code. Loud when nobody has used it, hidden once claimed —
            an active code on screen is a credential lying in the open. */}
        {code && (
          <div
            className={cn(
              'mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5',
              claimed ? 'bg-muted' : 'border-2 border-primary/30 bg-accent'
            )}
          >
            <span
              className={cn(
                'telemetry flex-1 font-bold tracking-[0.25em]',
                claimed && !isRevealed ? 'text-muted-foreground' : 'text-foreground',
                claimed ? 'text-base' : 'text-2xl'
              )}
            >
              {claimed && !isRevealed ? '••••••' : code}
            </span>

            {claimed && (
              <button
                type="button"
                onClick={() =>
                  setRevealed((prev) => {
                    const next = new Set(prev);
                    next.has(row.device.id) ? next.delete(row.device.id) : next.add(row.device.id);
                    return next;
                  })
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground"
                aria-label={isRevealed ? 'Hide code' : 'Show code'}
              >
                {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => copy(code)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground"
              aria-label="Copy code"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {!claimed && code && (
            <Button variant="outline" className="h-10 flex-1 gap-1.5 text-xs" onClick={() => share(row)}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}

          {claimed && (
            <Button
              variant="outline"
              className="h-10 flex-1 gap-1.5 text-xs text-destructive"
              disabled={busy}
              onClick={() => setPending({ kind: 'revoke', row })}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
              Revoke
            </Button>
          )}

          <Button
            variant="outline"
            className="h-10 flex-1 gap-1.5 text-xs"
            disabled={busy}
            onClick={() => setPending({ kind: 'newcode', row })}
          >
            <RefreshCw className="h-4 w-4" />
            New code
          </Button>

          {/* Deleting is only safe when nothing was ever recorded against it */}
          {!row.driver && (
            <Button
              variant="outline"
              className="h-10 flex-1 gap-1.5 text-xs text-destructive"
              disabled={busy}
              onClick={() => setPending({ kind: 'delete', row })}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/app/admin/fleet')}
          className="mb-1 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Fleet
        </button>
        <p className="text-xs text-muted-foreground">
          Revoking locks a driver out but keeps everything they recorded.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-heading text-base font-semibold">No codes yet</p>
            <p className="max-w-[17rem] text-sm text-muted-foreground">
              Create one and share it with a driver to get them on your map.
            </p>
          </div>
        )}

        {unclaimed.length > 0 && (
          <section className="mb-6">
            <p className="eyebrow mb-3">Ready to hand out</p>
            <ul className="space-y-2.5">{unclaimed.map(renderRow)}</ul>
          </section>
        )}

        {active.length > 0 && (
          <section>
            <p className="eyebrow mb-3">In use</p>
            <ul className="space-y-2.5">{active.map(renderRow)}</ul>
          </section>
        )}
      </div>

      <div
        className="border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button className="h-12 w-full gap-2" onClick={() => navigate('/app/admin/drivers/new')}>
          <Plus className="h-4 w-4" />
          New driver code
        </Button>
      </div>

      <ConfirmDialog
        open={pending?.kind === 'revoke'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Lock out ${pending?.row.driver?.driver_name || 'this driver'}?`}
        description="They stop sharing location immediately, and the old code stops working so they cannot rejoin with it. A fresh code is issued for this vehicle. Their visits, receipts and expenses are all kept — nothing is erased."
        confirmLabel="Revoke access"
        destructive
        onConfirm={() => pending?.kind === 'revoke' && revoke(pending.row)}
      />

      <ConfirmDialog
        open={pending?.kind === 'newcode'}
        onOpenChange={(open) => !open && setPending(null)}
        title="Issue a new code?"
        description="The current code stops working straight away. Anyone using it is signed out and will need the new one. Past records are unaffected."
        confirmLabel="Issue new code"
        onConfirm={() => pending?.kind === 'newcode' && rotate(pending.row)}
      />

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete this code?"
        description="No driver has ever used this code, so there is nothing recorded against it. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => pending?.kind === 'delete' && remove(pending.row)}
      />
    </div>
  );
}
