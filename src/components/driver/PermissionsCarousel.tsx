import { useEffect, useState } from 'react';
import { BatteryCharging, Bell, Check, ChevronRight, MapPin, ShieldCheck } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Button } from '@/components/ui/button';
import { requestNotificationPermission, notificationsEnabled } from '@/services/notifications';
import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';
import { cn } from '@/lib/utils';

const DONE_KEY = 'ftm_driver_permissions_done';

export function permissionsSetupDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === 'true';
  } catch {
    return true;
  }
}

type StepId = 'location' | 'notifications' | 'battery';

type Step = {
  id: StepId;
  icon: typeof MapPin;
  title: string;
  body: string;
  why: string;
  action: string;
};

const STEPS: Step[] = [
  {
    id: 'location',
    icon: MapPin,
    title: 'Share your location while on duty',
    body: 'Your manager sees where you are only while you are On Duty. Go Off Duty and it stops.',
    why: 'Choose "Allow all the time" when Android asks. "While using the app" stops the moment you switch to WhatsApp, and your work would go unrecorded.',
    action: 'Allow location',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Get told about new work',
    body: 'New jobs, stations you still owe, and confirmation that your receipt was sent.',
    why: 'Without this the app can only tell you things while you are staring at it.',
    action: 'Allow notifications',
  },
  {
    id: 'battery',
    icon: BatteryCharging,
    title: 'Keep tracking alive',
    body: 'Android battery saver can freeze apps in the background, which would stop your location and your proof being recorded.',
    why: 'Set FleetTrackMate to Unrestricted so your day records even with the app closed. This is the setting phones most often get wrong.',
    action: 'Open battery settings',
  },
];

/**
 * Asks for what the app needs, once, with the reason attached.
 *
 * Deliberately NOT a blocker. A driver can skip any step and still use the
 * app; permissions extracted under duress get revoked the same week, and a
 * driver who feels tricked stops trusting the tracking altogether. Explaining
 * the trade — and being plain that location stops when they go Off Duty —
 * earns a "yes" that survives.
 *
 * The battery step is the one that actually decides whether background
 * tracking survives on cheap Android hardware, and it is the one no app can
 * grant for itself: all we can do is open the right settings screen and say
 * what to pick.
 */
export default function PermissionsCarousel({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [granted, setGranted] = useState<Record<StepId, boolean>>({
    location: false,
    notifications: false,
    battery: false,
  });
  const [busy, setBusy] = useState(false);

  const steps = STEPS.filter((s) => (s.id === 'battery' ? isAndroid() : true));
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Reflect what is already granted, so a returning driver is not asked twice.
  useEffect(() => {
    void (async () => {
      try {
        const loc = await Geolocation.checkPermissions();
        const notif = await notificationsEnabled();
        setGranted((g) => ({
          ...g,
          location: loc.location === 'granted' || loc.coarseLocation === 'granted',
          notifications: notif,
        }));
      } catch {
        /* leave as not-granted */
      }
    })();
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, 'true');
    } catch {
      /* private mode */
    }
    onDone();
  };

  const advance = () => (isLast ? finish() : setIndex((i) => i + 1));

  const run = async () => {
    setBusy(true);
    try {
      if (step.id === 'location') {
        const result = await Geolocation.requestPermissions();
        setGranted((g) => ({
          ...g,
          location: result.location === 'granted' || result.coarseLocation === 'granted',
        }));
      } else if (step.id === 'notifications') {
        const ok = await requestNotificationPermission();
        setGranted((g) => ({ ...g, notifications: ok }));
      } else {
        // No app can exempt itself from battery optimisation; Android only
        // lets us open the screen where the driver does it.
        setGranted((g) => ({ ...g, battery: true }));
        if (detectNativePlatform()) {
          window.open(
            'intent://#Intent;action=android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS;end',
            '_system'
          );
        }
      }
    } catch (err) {
      console.warn('[PermissionsCarousel] request failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const Icon = step.icon;
  const done = granted[step.id];

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Soft colour wash so this reads as a welcome, not a warning */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 45% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-between px-5 pt-4">
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={finish}
          className="min-h-[44px] px-2 text-sm font-medium text-muted-foreground"
        >
          Skip
        </button>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-7">
        <span className="mb-7 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent">
          <Icon className="h-10 w-10 text-primary" />
        </span>

        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight">
          {step.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-6 flex gap-3 rounded-2xl border border-border bg-card p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-muted-foreground">{step.why}</p>
        </div>
      </div>

      <div className="relative space-y-2.5 px-7">
        {done ? (
          <Button className="h-12 w-full gap-2 text-base font-semibold" onClick={advance}>
            <Check className="h-5 w-5" />
            {isLast ? 'Done' : 'Next'}
          </Button>
        ) : (
          <>
            <Button
              className="h-12 w-full text-base font-semibold"
              disabled={busy}
              onClick={run}
            >
              {step.action}
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full gap-1 text-sm text-muted-foreground"
              onClick={advance}
            >
              Not now
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
