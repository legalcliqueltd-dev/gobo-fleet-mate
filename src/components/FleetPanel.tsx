import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShareCodeButton } from '@/components/ShareCodeButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DeviceWithLatest } from '@/hooks/useDeviceLocations';
import { DriverLocation } from '@/hooks/useDriverLocations';
import { getDriverAccent } from '@/lib/driverAccent';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, Plus, Clock, Copy, Check, ChevronDown, ChevronUp,
  ExternalLink, Unlink, Trash2, Pause, Play, Navigation, AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';

type Props = {
  devices: DeviceWithLatest[];
  drivers: DriverLocation[];
  loading: boolean;
  error: string | null;
  selectedDriverId?: string | null;
  onDriverSelect?: (driver: DriverLocation) => void;
  onTogglePause: (deviceId: string, currentlyPaused: boolean) => void;
  onDeleteDevice: (deviceId: string) => void;
};

type Slot = {
  key: string;
  device: DeviceWithLatest | null;
  driver: DriverLocation | null;
};

function isOnline(driver: DriverLocation): boolean {
  if (driver.status === 'offline' || driver.status === 'disconnected') return false;
  if (!driver.last_seen_at) return false;
  return Date.now() - new Date(driver.last_seen_at).getTime() < 5 * 60 * 1000;
}

function isRecentlyActive(driver: DriverLocation): boolean {
  if (!driver.last_seen_at) return false;
  return Date.now() - new Date(driver.last_seen_at).getTime() < 15 * 60 * 1000;
}

/** One plain sentence about the driver's tracking state — no badge soup. */
function statusLine(driver: DriverLocation): { text: string; warn: boolean } {
  const lastSeen = driver.last_seen_at
    ? new Date(driver.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const noGps = !driver.latitude || driver.latitude === 0;
  if (noGps) {
    return { text: 'App connected — GPS off. Ask the driver to go on duty.', warn: true };
  }

  const locUpdated = driver.updated_at ? new Date(driver.updated_at) : null;
  const minutesAgo = locUpdated ? (Date.now() - locUpdated.getTime()) / 60000 : Infinity;
  if (minutesAgo > 1440) {
    return { text: `Last seen ${lastSeen ?? '—'} · location ${Math.floor(minutesAgo / 1440)}d old`, warn: true };
  }
  if (minutesAgo > 60) {
    return { text: `Last seen ${lastSeen ?? '—'} · location ${Math.floor(minutesAgo / 60)}h old`, warn: true };
  }
  return { text: lastSeen ? `Last seen ${lastSeen}` : 'Never seen', warn: false };
}

/**
 * The merged fleet panel: one card per vehicle slot.
 * Unclaimed slot → the connection code is the hero.
 * Claimed slot → the driver is the hero; the code folds away.
 */
export default function FleetPanel({
  devices,
  drivers,
  loading,
  error,
  selectedDriverId,
  onDriverSelect,
  onTogglePause,
  onDeleteDevice,
}: Props) {
  const navigate = useNavigate();
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    { kind: 'disconnect' | 'delete-driver'; driver: DriverLocation } | null
  >(null);

  const slots = useMemo<Slot[]>(() => {
    const driverById = new Map(drivers.map((d) => [d.driver_id, d]));
    // Fallback join: a driver's admin_code is the connection code they redeemed.
    // Older device rows never had connected_driver_id filled in, which split one
    // person into two cards (an "online driver" + a "waiting vehicle").
    const driverByCode = new Map(drivers.map((d) => [d.admin_code, d]));
    const claimedDriverIds = new Set<string>();

    const deviceSlots: Slot[] = devices.map((device) => {
      const driver =
        (device.connected_driver_id ? driverById.get(device.connected_driver_id) : null) ??
        (device.connection_code ? driverByCode.get(device.connection_code) : null) ??
        null;
      if (driver) claimedDriverIds.add(driver.driver_id);
      return { key: `device-${device.id}`, device, driver };
    });

    // Drivers that connected but aren't linked to a listed device still show up.
    const orphanSlots: Slot[] = drivers
      .filter((d) => !claimedDriverIds.has(d.driver_id))
      .map((driver) => ({ key: `driver-${driver.driver_id}`, device: null, driver }));

    // Claimed and live slots first, waiting slots after.
    return [...deviceSlots, ...orphanSlots].sort((a, b) => Number(!!b.driver) - Number(!!a.driver));
  }, [devices, drivers]);

  const toggleCode = (key: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyCode = async (code: string, key: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(key);
      toast.success('Code copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const performDisconnect = async (driver: DriverLocation) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'disconnected' })
        .eq('driver_id', driver.driver_id);
      if (error) throw error;
      toast.success('Driver disconnected');
    } catch (err) {
      console.error('Error disconnecting:', err);
      toast.error('Failed to disconnect driver');
    }
  };

  const performDeleteDriver = async (driver: DriverLocation) => {
    try {
      await supabase.from('driver_locations').delete().eq('driver_id', driver.driver_id);
      const { error } = await supabase.from('drivers').delete().eq('driver_id', driver.driver_id);
      if (error) throw error;
      toast.success('Driver deleted');
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Failed to delete driver');
    }
  };

  return (
    <Card className="border border-border">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
            <div className="rounded-md bg-primary/15 p-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            Drivers
            {drivers.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {drivers.length} connected
              </span>
            )}
          </h3>
          <Link to="/devices/new">
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add driver
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        {loading && (
          <div className="flex items-center justify-center py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
        {!loading && slots.length === 0 && (
          <div className="py-4 text-center">
            <Users className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No drivers yet.</p>
            <Link to="/devices/new" className="text-xs text-primary hover:underline">
              Add your first driver →
            </Link>
          </div>
        )}

        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {slots.map((slot) => {
            const { device, driver } = slot;
            const paused = !!device?.is_paused;
            const accent = driver ? getDriverAccent(driver.driver_id) : null;
            const online = driver ? isOnline(driver) : false;
            const away = driver ? !online && isRecentlyActive(driver) : false;
            const isSelected = !!driver && selectedDriverId === driver.driver_id;
            const line = driver ? statusLine(driver) : null;
            const codeOpen = expandedCodes.has(slot.key);
            const name = driver?.driver_name || device?.name || 'Unnamed';

            return (
              <li key={slot.key}>
                <div
                  className={clsx(
                    'rounded-lg border p-2.5 transition-all',
                    paused
                      ? 'border-muted bg-muted/30 opacity-60'
                      : isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card/50 hover:border-primary/50'
                  )}
                >
                  {/* Header row: identity + housekeeping */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        if (!driver) return;
                        // Single click → fly the map to the driver.
                        // Double click → open the driver's details page.
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                          navigate(`/driver/${driver.driver_id}`);
                          return;
                        }
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          onDriverSelect?.(driver);
                        }, 250);
                      }}
                      className={clsx('flex min-w-0 flex-1 items-center gap-2 text-left', !driver && 'cursor-default')}
                      title={driver ? 'Click: show on map · Double-click: open details' : undefined}
                    >
                      {accent ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
                          style={{ backgroundColor: accent }}
                        />
                      ) : (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground/60" />
                      )}
                      <span className={clsx('truncate text-sm font-semibold', paused && 'line-through text-muted-foreground')}>
                        {name}
                      </span>
                      {driver ? (
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                            online
                              ? 'bg-success text-success-foreground'
                              : away
                                ? 'bg-warning text-warning-foreground'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {online ? 'Online' : away ? 'Away' : 'Offline'}
                        </span>
                      ) : (
                        !paused && (
                          <Badge variant="outline" className="border-primary/40 px-1.5 py-0 text-[10px] text-primary">
                            Waiting for driver
                          </Badge>
                        )
                      )}
                      {paused && (
                        <Badge variant="outline" className="border-muted-foreground/30 px-1.5 py-0 text-[10px] text-muted-foreground">
                          PAUSED
                        </Badge>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      {driver && (
                        <>
                          <Link
                            to={`/driver/${driver.driver_id}`}
                            className="rounded-md p-1.5 hover:bg-primary/10"
                            title="Open driver details"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-primary" />
                          </Link>
                          <button
                            onClick={() => setConfirmAction({ kind: 'disconnect', driver })}
                            className="rounded-md p-1.5 hover:bg-warning/10"
                            title="Disconnect driver"
                          >
                            <Unlink className="h-3.5 w-3.5 text-warning" />
                          </button>
                        </>
                      )}
                      {device && (
                        <>
                          <button
                            onClick={() => onTogglePause(device.id, paused)}
                            className={clsx('rounded-md p-1.5', paused ? 'hover:bg-success/10' : 'hover:bg-warning/10')}
                            title={paused ? 'Resume tracking' : 'Pause tracking'}
                          >
                            {paused ? <Play className="h-3.5 w-3.5 text-success" /> : <Pause className="h-3.5 w-3.5 text-warning" />}
                          </button>
                          <button
                            onClick={() => onDeleteDevice(device.id)}
                            className="rounded-md p-1.5 hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </>
                      )}
                      {!device && driver && (
                        <button
                          onClick={() => setConfirmAction({ kind: 'delete-driver', driver })}
                          className="rounded-md p-1.5 hover:bg-destructive/10"
                          title="Delete driver"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status line (claimed) */}
                  {driver && line && (
                    <div className={clsx('mt-1.5 flex flex-wrap items-center gap-3 text-xs', line.warn ? 'text-warning' : 'text-muted-foreground')}>
                      <span className="flex items-center gap-1">
                        {line.warn ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {line.text}
                      </span>
                      {driver.speed !== null && driver.speed > 0 && (
                        <span className="flex items-center gap-1 text-success">
                          <Navigation className="h-3 w-3" />
                          {Math.round(driver.speed)} km/h
                        </span>
                      )}
                    </div>
                  )}

                  {/* Connection code:
                      unclaimed → the hero of the card;
                      claimed   → folded behind a small disclosure. */}
                  {device?.connection_code && !paused && (
                    !driver ? (
                      <div className="mt-2.5 rounded-lg border border-primary/30 bg-accent/60 p-3">
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          Connection code
                        </p>
                        <button
                          onClick={() => copyCode(device.connection_code!, slot.key)}
                          className="flex w-full items-center justify-center gap-2 text-center"
                          title="Copy code"
                        >
                          <span className="telemetry text-3xl font-bold tracking-[0.25em]">
                            {device.connection_code}
                          </span>
                          {copiedId === slot.key ? (
                            <Check className="h-4 w-4 shrink-0 text-success" />
                          ) : (
                            <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                        <ShareCodeButton
                          code={device.connection_code}
                          deviceName={device.name ?? undefined}
                          size="default"
                          className="mt-2.5 w-full"
                        />
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          Send this code to your driver — they enter it in the app to connect.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleCode(slot.key)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {codeOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Connection code
                        </button>
                        {codeOpen && (
                          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-1.5 pl-2.5">
                            <button
                              onClick={() => copyCode(device.connection_code!, slot.key)}
                              className="flex min-w-0 items-center gap-1.5 text-left"
                              title="Copy code"
                            >
                              <span className="telemetry truncate text-base font-semibold tracking-[0.2em]">
                                {device.connection_code}
                              </span>
                              {copiedId === slot.key ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                            <ShareCodeButton
                              code={device.connection_code}
                              deviceName={device.name ?? undefined}
                              size="sm"
                              className="h-8 shrink-0"
                            />
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Last fix (unclaimed slots show it too so admins see stale hardware) */}
                  {device && !driver && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="truncate">
                        {device.latest ? new Date(device.latest.timestamp).toLocaleString() : 'No location yet'}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      {/* Styled confirmations */}
      <ConfirmDialog
        open={confirmAction?.kind === 'disconnect'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`Disconnect ${confirmAction?.driver.driver_name || 'this driver'}?`}
        description="The driver will stop sharing their location and will need their connection code to reconnect."
        confirmLabel="Disconnect"
        onConfirm={() => {
          if (confirmAction) performDisconnect(confirmAction.driver);
          setConfirmAction(null);
        }}
      />
      <ConfirmDialog
        open={confirmAction?.kind === 'delete-driver'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`Delete ${confirmAction?.driver.driver_name || 'this driver'}?`}
        description="The driver and all their location history will be permanently deleted. This cannot be undone."
        confirmLabel="Delete driver"
        destructive
        onConfirm={() => {
          if (confirmAction) performDeleteDriver(confirmAction.driver);
          setConfirmAction(null);
        }}
      />
    </Card>
  );
}
