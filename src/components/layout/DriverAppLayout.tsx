import { PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Settings, ArrowLeft, Car } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { cn } from '@/lib/utils';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { useDrivingMode } from '@/hooks/useDrivingMode';
import OfflineQueue from '@/components/OfflineQueue';

const leftNavItems = [
  { path: '/app/dashboard', icon: Home, label: 'Home' },
  { path: '/app/tasks', icon: ClipboardList, label: 'Tasks' },
];
const rightNavItems = [
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function DriverAppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useDriverSession();
  const { unreadCount } = useTaskNotifications(session?.driverId, session?.adminCode);
  const { isDriving, speedKmh } = useDrivingMode();

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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
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
            <img src={logo} alt="FleetTrackMate" className="h-8 w-8 rounded-lg" />
            <span className="font-heading text-lg font-semibold tracking-tight">Driver</span>
          </Link>

          {/* Spacer for centering when back button is shown */}
          {!isHomePage && <div className="w-[52px]" />}
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

      {/* Offline sync queue */}
      <OfflineQueue />

      {/* Bottom navigation — SOS is the raised center control so it is
          always the easiest target in an emergency. */}
      <nav
        className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center px-3 py-1.5">
          <div className="flex flex-1">{leftNavItems.map(renderNavItem)}</div>

          {/* SOS */}
          <Link
            to="/app/sos"
            aria-label="SOS — send emergency alert"
            className="relative -mt-7 mx-1 flex flex-col items-center"
          >
            <span
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 transition-transform active:scale-95',
                isSOSActive && 'ring-2 ring-destructive ring-offset-2 ring-offset-background'
              )}
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <span className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-destructive">
              SOS
            </span>
          </Link>

          <div className="flex flex-1">{rightNavItems.map(renderNavItem)}</div>
        </div>
      </nav>
    </div>
  );
}
