import { PropsWithChildren, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Map, ClipboardList, AlertTriangle, BarChart3, MapPin, Settings } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { cn } from '@/lib/utils';
import { useSOSNotifications } from '@/hooks/useSOSNotifications';
import AdminTutorial from '@/components/admin/AdminTutorial';

type Tab = {
  path: string;
  icon: typeof Map;
  label: string;
  title: string;
};

const TABS: Tab[] = [
  { path: '/app/admin/fleet', icon: Map, label: 'Fleet', title: 'Live fleet' },
  { path: '/app/admin/tasks', icon: ClipboardList, label: 'Jobs', title: 'Jobs' },
  { path: '/app/admin/stations', icon: MapPin, label: 'Stations', title: 'Stations' },
  { path: '/app/admin/alerts', icon: AlertTriangle, label: 'Alerts', title: 'Alerts' },
  { path: '/app/admin/insights', icon: BarChart3, label: 'Insights', title: 'Insights' },
  { path: '/app/admin/settings', icon: Settings, label: 'Settings', title: 'Settings' },
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
    { match: '/app/admin/drivers/new', parent: '/app/admin/fleet', title: 'Add driver' },
    { match: '/app/admin/codes', parent: '/app/admin/fleet', title: 'Drivers & codes' },
    { match: '/app/admin/history', parent: '/app/admin/fleet', title: 'History' },
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
            const badge = path === '/app/admin/alerts' && openSOSCount > 0 ? openSOSCount : 0;

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
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold text-destructive-foreground">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                {/* 10px keeps six labels legible without wrapping on a 360dp
                    screen; the 44px tap target above is unchanged. */}
                <span className={cn('text-[10px]', isActive ? 'font-semibold' : 'font-medium')}>
                  {label}
                </span>
                {isActive && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      </nav>

        {showTutorial && <AdminTutorial onClose={() => setShowTutorial(false)} />}
      </div>
    </div>
  );
}
