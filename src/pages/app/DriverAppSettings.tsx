import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useAppRole } from '@/contexts/AppRoleContext';
import { detectNativePlatform } from '@/utils/platformDetection';
import { supabase } from '@/integrations/supabase/client';
import { trackingService } from '@/services/trackingService';
import {
  notificationsEnabled,
  requestNotificationPermission,
} from '@/services/notifications';
import { Switch } from '@/components/ui/switch';
import { User, Battery, Bell, MapPin, Unlink, Power, AlertTriangle, Trash2, Shield, FileText, GraduationCap, Repeat, ClipboardCheck, ShieldCheck, Wallet, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import DriverOnboarding from '@/components/driver/DriverOnboarding';
import ThemeSegmented from '@/components/ThemeSegmented';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * A labelled group of rows.
 *
 * Replaces nine stacked Cards, each with its own icon, bold title and
 * padding. That furniture was most of the screen's height and none of its
 * information — a driver looking for the duty switch had to scroll past four
 * headings to reach it. A small mono label and a divided list say the same
 * thing in a fifth of the space, and match how Jobs and Stations already look.
 */
function Group({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section>
      <h2 className="mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
      {note && (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">{note}</p>
      )}
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  right,
  onClick,
  tone,
}: {
  icon?: typeof Bell;
  label: string;
  hint?: string;
  right?: ReactNode;
  onClick?: () => void;
  tone?: 'danger';
}) {
  const content = (
    <>
      {Icon && (
        <Icon
          className={cn(
            'h-[18px] w-[18px] shrink-0',
            tone === 'danger' ? 'text-destructive' : 'text-muted-foreground'
          )}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-semibold leading-tight',
            tone === 'danger' && 'text-destructive'
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
        )}
      </span>
      {right}
    </>
  );

  const shell = 'flex w-full min-h-[60px] items-center gap-3.5 px-4 py-3 text-left';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shell, 'transition-colors active:bg-muted')}>
        {content}
      </button>
    );
  }
  return <div className={shell}>{content}</div>;
}

export default function DriverAppSettings() {
  const { session, disconnect } = useDriverSession();
  const { clearRole } = useAppRole();
  const navigate = useNavigate();
  const isNativeApp = detectNativePlatform();
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Duty status - defaults to true
  const [onDuty, setOnDuty] = useState(() => {
    const stored = localStorage.getItem('driverOnDuty');
    return stored === null ? true : stored === 'true';
  });
  
  // Settings state (stored in localStorage for persistence)
  const [batterySaving, setBatterySaving] = useState(
    localStorage.getItem('batterySavingMode') === 'true'
  );
  const [highAccuracy, setHighAccuracy] = useState(
    localStorage.getItem('highAccuracyMode') !== 'false'
  );

  // Reflects the OS setting, not a preference of ours — there is nothing to
  // store, and a switch that lies about whether alerts will arrive is worse
  // than no switch. iOS only ever shows its prompt once, so once the answer
  // is "no" the row sends the driver to Settings instead of asking again.
  const [alertsOn, setAlertsOn] = useState(false);

  useEffect(() => {
    let alive = true;
    notificationsEnabled().then((granted) => {
      if (alive) setAlertsOn(granted);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleAlertsChange = async (checked: boolean) => {
    if (!checked) {
      toast.info('Turn alerts off in your phone\u2019s Settings app for TrackMate.');
      return;
    }
    const granted = await requestNotificationPermission();
    setAlertsOn(granted);
    toast[granted ? 'success' : 'error'](
      granted
        ? 'Alerts on \u2014 you will hear new jobs and station arrivals.'
        : 'Your phone is blocking alerts. Turn them on in Settings for TrackMate.'
    );
  };

  const handleDutyChange = (checked: boolean) => {
    if (checked) {
      setOnDuty(true);
      localStorage.setItem('driverOnDuty', 'true');
      if (session?.driverId && session?.adminCode) {
        trackingService.start(session.driverId, session.adminCode).catch(console.error);
      }
      toast.success('Tracking enabled - you are now on duty');
    }
  };

  const confirmTurnOffDuty = () => {
    setOnDuty(false);
    localStorage.setItem('driverOnDuty', 'false');
    trackingService.stop().catch(console.error);
    toast.warning('Tracking disabled - your location is no longer being shared');
  };

  const handleBatterySavingChange = (checked: boolean) => {
    setBatterySaving(checked);
    localStorage.setItem('batterySavingMode', String(checked));
    toast.success(checked ? 'Battery saving mode enabled' : 'Battery saving mode disabled');
  };

  const handleHighAccuracyChange = (checked: boolean) => {
    setHighAccuracy(checked);
    localStorage.setItem('highAccuracyMode', String(checked));
    toast.success(checked ? 'High accuracy enabled' : 'High accuracy disabled');
  };

  const handleDeleteAccount = async () => {
    if (!session?.driverId || !session?.adminCode) {
      toast.error('Not connected. Nothing to delete.');
      return;
    }
    setDeleting(true);
    try {
      await trackingService.stop().catch(() => {});

      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'delete-driver',
          driverId: session.driverId,
          adminCode: session.adminCode,
        },
      });

      if (error || !data?.success) {
        const message = (error as { message?: string } | null)?.message
          || (data as { error?: string } | null)?.error
          || 'Failed to delete account';
        toast.error(message);
        return;
      }

      // Clear all local app state
      try {
        localStorage.removeItem('driverOnDuty');
        localStorage.removeItem('driver_location_trail');
        localStorage.removeItem('trail_last_sync_ts');
        localStorage.removeItem('batterySavingMode');
        localStorage.removeItem('highAccuracyMode');
      } catch { /* ignore */ }

      disconnect();
      toast.success('Your driver profile and history have been deleted.');
      navigate('/app/connect', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Stop persistent tracking immediately
      await trackingService.stop().catch(() => {});

      // Call the edge function to update status
      await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'disconnect',
          driverId: session?.driverId,
        },
      });

      // Clear local session
      disconnect();
      toast.success('Disconnected from fleet');
      navigate('/app/connect');
    } catch (err: any) {
      console.error('Disconnect error:', err);
      // Still disconnect locally even if server call fails
      disconnect();
      toast.success('Disconnected from fleet');
      navigate('/app/connect');
    } finally {
      setDisconnecting(false);
    }
  };

  if (showTutorial) {
    return <DriverOnboarding onComplete={() => setShowTutorial(false)} />;
  }

  return (
    <DriverAppLayout>
      {/* Ordered by how often a driver opens it, not by how the code is
          organised. Duty is the thing he changes daily and it sat fifth down
          the page, under Profile — a read-only name he already knows. */}
      <div className="space-y-6 px-4 pb-8 pt-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>

        <Group
          title="Duty"
          note={onDuty ? undefined : 'Your manager cannot see you while this is off.'}
        >
          <Row
            icon={Power}
            label="On duty"
            hint="Share your location with your manager"
            right={
              onDuty ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Switch checked className="data-[state=checked]:bg-success" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        Go off duty?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your manager will no longer see where you are. This can affect the
                        jobs you get and how quickly anyone can reach you in an emergency.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Stay on duty</AlertDialogCancel>
                      <AlertDialogAction onClick={confirmTurnOffDuty}>
                        Yes, stop sharing
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Switch checked={false} onCheckedChange={handleDutyChange} />
              )
            }
          />
        </Group>

        {/* These belong to the driver. Everything else on this screen
            configures what the office receives. */}
        <Group title="Yours" note="Your manager only sees what you send.">
          <Row
            icon={Wallet}
            label="Money"
            hint="Log fuel, repairs and tolls to get paid back"
            onClick={() => navigate('/app/expenses')}
            right={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          />
          <Row
            icon={ClipboardCheck}
            label="My record"
            hint="Your week of work, and every receipt you sent"
            onClick={() => navigate('/app/record')}
            right={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          />
          <Row
            icon={ShieldCheck}
            label="Vehicle check"
            hint="Log faults before you drive, or report a problem"
            onClick={() => navigate('/app/checks')}
            right={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          />
        </Group>

        <Group title="Tracking">
          {isNativeApp && (
            <Row
              icon={Bell}
              label="Alerts"
              hint="New jobs, stations you owe a visit, low battery"
              right={<Switch checked={alertsOn} onCheckedChange={handleAlertsChange} />}
            />
          )}
          <Row
            icon={MapPin}
            label="High accuracy"
            hint="Uses GPS for a more precise position"
            right={<Switch checked={highAccuracy} onCheckedChange={handleHighAccuracyChange} />}
          />
          <Row
            icon={Battery}
            label="Battery saving"
            hint="Fewer updates, longer battery"
            right={<Switch checked={batterySaving} onCheckedChange={handleBatterySavingChange} />}
          />
        </Group>

        <section>
          <h2 className="mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Appearance
          </h2>
          <ThemeSegmented />
        </section>

        <Group title="Help">
          <Row
            icon={GraduationCap}
            label="App tutorial"
            hint="A quick tour of every button"
            onClick={() => setShowTutorial(true)}
            right={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          />
          {isNativeApp && (
            <Row
              icon={Repeat}
              label="Switch mode"
              hint="Use this device as a manager"
              onClick={() => {
                clearRole();
                navigate('/app/role', { replace: true });
              }}
              right={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            />
          )}
        </Group>

        <Group title="Account">
          <Row
            icon={User}
            label={session?.driverName || 'Unknown driver'}
            hint={session?.adminCode ? 'Fleet code ' + session.adminCode : 'Not connected'}
          />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={disconnecting}
                className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-muted disabled:opacity-50"
              >
                <Unlink className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {disconnecting ? 'Disconnecting…' : 'Disconnect from fleet'}
                </span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect from fleet?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will need your name and connection code again to reconnect. Your
                  location will stop being shared.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={deleting}
                className="flex min-h-[60px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-muted disabled:opacity-50"
              >
                <Trash2 className="h-[18px] w-[18px] shrink-0 text-destructive" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight text-destructive">
                    {deleting ? 'Deleting…' : 'Delete my account'}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    Removes your profile, history and everything you sent
                  </span>
                </span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your driver profile, location history, and any photos or videos you have
                  submitted will be permanently removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Group>

        <div className="flex items-center justify-center gap-5 pt-1 text-xs">
          <Link to="/privacy" className="flex items-center gap-1.5 text-muted-foreground">
            <Shield className="h-3 w-3" /> Privacy
          </Link>
          <Link to="/terms" className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3 w-3" /> Terms
          </Link>
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          TrackMate Driver · v1.0.0
        </p>
      </div>
    </DriverAppLayout>
  );
}
