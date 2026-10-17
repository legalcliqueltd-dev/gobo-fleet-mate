import { PropsWithChildren, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Settings, ArrowLeft, Car, Wallet, MapPin, MoreHorizontal, X, Camera, ClipboardCheck } from 'lucide-react';
import logo from '@/assets/brand/trackmate-icon.svg';
import { cn } from '@/lib/utils';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { useDrivingMode } from '@/hooks/useDrivingMode';
import { useAccessGuard } from '@/hooks/useAccessGuard';

/**
 * A driver has two jobs: the work he was given, and the places he owes a
 * visit. Those are the only two destinations that earn a tab.
 *
 * SOS used to be a raised red circle in the middle of this bar — the single
 * loudest thing in the app, on a screen opened a hundred times a day for
 * reasons that are never an emergency. It now sits quietly in the header:
 * one tap away when it is needed, invisible as a priority when it is not.
 */
const NAV_ITEMS = [
  { path: '/app/dashboard', icon: Home, label: 'Home' },
  { path: '/app/tasks', icon: ClipboardList, label: 'Jobs' },
  { path: '/app/stations', icon: MapPin, label: 'Stations' },
];

/** Real, but not every day. */
const MORE = [
  { path: '/app/expenses', icon: Wallet, label: 'Money', note: 'Fuel and what you spent' },
  { path: '/app/record', icon: Camera, label: 'My proof', note: 'Photos and receipts you sent' },
  { path: '/app/checks', icon: ClipboardCheck, label: 'Vehicle checks', note: 'Report a fault' },
  { path: '/app/settings', icon: Settings, label: 'Settings', note: 'Duty, alerts and location' },
];

export default function DriverAppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useDriverSession();
  const { unreadCount } = useTaskNotifications(session?.driverId, session?.adminCode);
  const { isDriving, speedKmh } = useDrivingMode();
  const [moreOpen, setMoreOpen] = useState(false);

  // Enforces manager-side revocation on this device.
  useAccessGuard();

  // Check if on home page
  const isHomePage = location.pathname === '/app' || location.pathname === '/app/dashboard';
  const isSOSActive = location.pathname === '/app/sos';

  const renderNavItem = (item: { path: string; icon: typeof Home; label: string }) => {
    const Icon = item.icon;
    const isActive =
      location.pathname === item.path ||
      (item.path === '/app/dashboard' && location.pathname === '/app');
    const hasBadge = item.path === '/app/tasks' && unreadCount > 0;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <div className="relative">
          <Icon className="h-5 w-5" />
          {hasBadge && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive font-mono text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className={cn('text-[11px]', isActive ? 'font-semibold' : 'font-medium')}>
          {item.label}
        </span>
        {isActive && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
      </Link>
    );
  };

  return (
    // Centred column. The app is a phone UI and the binary must keep declaring
    // iPad support (ITMS-90101 forbids dropping it once shipped), so the choice
    // is between a stretched phone and a deliberate column. On iPhone
    // max-w-2xl is wider than the screen, making this wrapper inert.
    <div className="flex h-screen justify-center overflow-hidden bg-muted/40">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background">
      {/* Header with back button */}
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center px-3 py-2.5">
          {/* Back button - only on non-home pages */}
          {!isHomePage && (
            <button
              onClick={() => navigate(-1)}
              className="mr-2 flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-muted"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* Centered brand */}
          <Link
            to="/app"
            className={cn('flex items-center gap-2.5', isHomePage ? 'mx-auto' : 'flex-1 justify-center')}
          >
            <img src={logo} alt="TrackMate" className="h-8 w-8 rounded-lg" />
            <span className="font-heading text-lg font-semibold tracking-tight">Driver</span>
          </Link>

          {/* SOS. Reachable from every screen, loud only once pressed. */}
          <Link
            to="/app/sos"
            aria-label="SOS — send an emergency alert"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
              isSOSActive ? 'bg-sos text-sos-foreground' : 'text-sos active:bg-sos/10'
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Driving-mode hint — passive banner that nudges the driver to pull
          over before interacting. The SOS button on the bottom nav remains
          fully reachable. */}
      {isDriving && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/15 px-4 py-2"
        >
          <Car className="h-4 w-4 text-warning" />
          <span className="text-xs font-medium text-warning">
            Driving detected ({Math.round(speedKmh)} km/h) — please pull over before interacting.
          </span>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>

      {/* The Sync Queue panel used to sit here, on EVERY driver screen: a
          card headed "Online • 1 pending (1 mirror)" with Sync and delete
          buttons. It was a developer's view of an internal queue shown to a
          driver, in words he has no use for, taking the bottom of every
          page. The same facts now live in the duty panel on Home, in his
          language ("Saved here: 2"), and the queue drains itself on signal,
          resume and visibility — so there was never anything for him to
          press. The component is kept for the admin side; it is just no
          longer wallpaper on the driver's phone. */}

      {/* Bottom navigation. SOS is NOT here — it sits in the header, so the
          bar carries only the three places a driver actually goes. */}
      <nav
        className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch px-1.5 py-1.5">
          {NAV_ITEMS.map(renderNavItem)}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors',
              moreOpen ? 'text-primary' : 'text-muted-foreground'
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
            className="relative mx-auto w-full max-w-lg rounded-t-3xl border-t border-border bg-background"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
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
            <div className="px-3 pb-2">
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
      </div>
    </div>
  );
}
