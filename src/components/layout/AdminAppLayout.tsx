import { PropsWithChildren, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Map, ClipboardList, AlertTriangle, BarChart3, MapPin, Settings, MoreHorizontal, X, UserPlus, KeyRound, Wallet, History, ClipboardCheck, CalendarDays } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import logo from '@/assets/brand/trackmate-icon.svg';
import { cn } from '@/lib/utils';
import { useSOSNotifications } from '@/hooks/useSOSNotifications';
import AdminTutorial from '@/components/admin/AdminTutorial';

type Tab = {
  path: string;
  icon: typeof Map;
  label: string;
  title: string;
};

/**
 * Five tabs, not six.
 *
 * Alerts is a notification surface, not a place you browse — you go there
 * because something happened, which is exactly what a header bell is for. It
 * moved out of the tab bar so the five remaining destinations each answer
 * "what is this for?" without hesitating, and so six 10px labels stop fighting
 * for a 360dp screen.
 */
/**
 * Three destinations, then everything else behind one control.
 *
 * Fleet, Jobs and Stations are the three things a manager opens the app to
 * do. Insights and Settings were taking a fifth of the bar each to be
 * visited weekly, so they moved into the overflow with the rest. A tab bar
 * where every item is equally weighted teaches nothing about what matters.
 */
const TABS: Tab[] = [
  { path: '/app/admin/fleet', icon: Map, label: 'Fleet', title: 'Live fleet' },
  { path: '/app/admin/tasks', icon: ClipboardList, label: 'Jobs', title: 'Jobs' },
  { path: '/app/admin/stations', icon: MapPin, label: 'Stations', title: 'Stations' },
];

/** Everything that is real but not daily. Grouped the way the work groups. */
const MORE: { path: string; icon: typeof Map; label: string; note: string }[] = [
  { path: '/app/admin/drivers/new', icon: UserPlus, label: 'Add a driver', note: 'Create a connection code' },
  { path: '/app/admin/codes', icon: KeyRound, label: 'Drivers & access', note: 'Issue, replace or revoke' },
  { path: '/app/admin/insights', icon: BarChart3, label: 'Insights', note: 'Distance and per-driver figures' },
  { path: '/app/admin/history', icon: History, label: 'History', note: 'Replay any driver’s day' },
  { path: '/app/admin/today', icon: CalendarDays, label: "Today's summary", note: 'End-of-day figures' },
  { path: '/app/admin/expenses', icon: Wallet, label: 'Expenses', note: 'What your drivers spent' },
  { path: '/app/admin/reports', icon: ClipboardCheck, label: 'Checks & problems', note: 'Faults drivers raised' },
  { path: '/app/admin/settings', icon: Settings, label: 'Settings', note: 'Account and preferences' },
];

/**
 * Shell for the native manager portal.
 *
 * Deliberately mirrors DriverAppLayout — same header height, same bottom-tab
 * rhythm, same safe-area handling — so the two halves of the app feel like one
 * product. The difference is the tab set and the absence of the raised SOS
 * button, which is a driver-only control.
 *
 * The Fleet tab owns the full viewport for its map, so this layout never adds
 * page padding; each screen decides its own.
 */
/** Shown once, on the manager's first arrival in the portal. */
const TUTORIAL_SEEN_KEY = 'ftm_admin_tutorial_seen';

export default function AdminAppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const { openSOSCount } = useSOSNotifications();

  // First run gets the tour automatically; every run after that it lives in
  // Settings only. The flag is written as soon as it opens, not when it is
  // finished — someone who skips it has still made their choice, and being
  // shown it again would read as nagging.
  const [showTutorial, setShowTutorial] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_SEEN_KEY)) return;
      localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
      setShowTutorial(true);
    } catch {
      /* private mode — simply never auto-shows */
    }
  }, []);

  // Sub-routes are not tabs of their own: they keep their parent tab lit and
  // supply their own header title.
  const SUB_ROUTES: { match: string; parent: string; title: string }[] = [
    { match: '/app/admin/alerts', parent: '/app/admin/alerts', title: 'Alerts' },
    { match: '/app/admin/drivers/new', parent: '/app/admin/fleet', title: 'Add driver' },
    { match: '/app/admin/codes', parent: '/app/admin/fleet', title: 'Drivers & codes' },
    { match: '/app/admin/history', parent: '/app/admin/insights', title: 'History' },
    { match: '/app/admin/expenses', parent: '/app/admin/insights', title: 'Expenses' },
    { match: '/app/admin/reports', parent: '/app/admin/insights', title: 'Checks & problems' },
    { match: '/app/admin/today', parent: '/app/admin/insights', title: "Today's summary" },
    { match: '/app/admin/drivers/', parent: '/app/admin/fleet', title: 'Driver' },
    { match: '/app/admin/jobs/new', parent: '/app/admin/tasks', title: 'Assign job' },
    { match: '/app/admin/stations/', parent: '/app/admin/stations', title: 'Station' },
  ];

  const subRoute = SUB_ROUTES.find((route) => location.pathname.startsWith(route.match));
  const activeTabPath = subRoute?.parent ?? location.pathname;
  const activeTab = TABS.find((tab) => activeTabPath.startsWith(tab.path));
  const title = subRoute?.title ?? activeTab?.title ?? 'Fleet';

  return (
    // Centred column. The app is a phone UI and the binary must keep declaring
    // iPad support (ITMS-90101 forbids dropping it once shipped), so the choice
    // is between a stretched phone and a deliberate column. On iPhone
    // max-w-2xl is wider than the screen, making this wrapper inert.
    <div className="flex h-screen justify-center overflow-hidden bg-muted/40">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Manager
            </p>
            <h1 className="truncate font-heading text-lg font-semibold leading-tight tracking-tight">
              {title}
            </h1>
          </div>

          {/* Alerts live here now. A bell is understood without a label, and it
              only demands attention when it has something to say. */}
          <RouterLink
            to="/app/admin/alerts"
            aria-label={openSOSCount > 0 ? `Alerts, ${openSOSCount} open` : 'Alerts'}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
          >
            <AlertTriangle className="h-5 w-5" />
            {openSOSCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold text-destructive-foreground">
                {openSOSCount > 9 ? '9+' : openSOSCount}
              </span>
            )}
          </RouterLink>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      <nav
        className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch px-1.5 py-1.5">
          {TABS.map(({ path, icon: Icon, label }) => {
            const isActive = activeTabPath.startsWith(path);

            return (
              <Link
                key={path}
                to={path}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {/* Five labels now, so 11px fits without wrapping on a 360dp
                    screen; the 44px tap target is unchanged. */}
                <span className={cn('text-[11px]', isActive ? 'font-semibold' : 'font-medium')}>
                  {label}
                </span>
                {isActive && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}

          {/* The fourth control is not a destination — it is the door to the
              rest. Labelled "More" rather than left as a bare glyph, because
              an unlabelled ⋯ in a tab bar is a guess. */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className={cn(
              'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors',
              moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[11px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div
            className="relative mx-auto w-full max-w-2xl rounded-t-3xl border-t border-border bg-background pb-2"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <p className="font-heading text-lg font-bold tracking-tight">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[66vh] overflow-y-auto px-3 pb-3">
              {MORE.map(({ path, icon: Icon, label, note }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-[56px] items-center gap-3.5 rounded-xl px-2.5 py-2 transition-colors active:bg-muted"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Icon className="h-[18px] w-[18px] text-accent-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{note}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

        {showTutorial && <AdminTutorial onClose={() => setShowTutorial(false)} />}
      </div>
    </div>
  );
}
