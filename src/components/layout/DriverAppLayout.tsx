import { PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Settings, ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { cn } from '@/lib/utils';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import OfflineQueue from '@/components/OfflineQueue';

const baseNavItems = [
  { path: '/app/dashboard', icon: Home, label: 'Home' },
  { path: '/app/tasks', icon: ClipboardList, label: 'Tasks' },
  { path: '/app/sos', icon: AlertTriangle, label: 'SOS' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function DriverAppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useDriverSession();
  const { unreadCount } = useTaskNotifications(session?.driverId);
  
  // Check if on home page
  const isHomePage = location.pathname === '/app' || location.pathname === '/app/dashboard';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with back button */}
      <header 
        className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-4 py-3 flex items-center">
          {/* Back button - only show on non-home pages */}
          {!isHomePage && (
            <button 
              onClick={() => navigate(-1)}
              className="mr-3 p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          
          {/* Centered logo */}
          <Link to="/app" className={cn(
            "flex items-center gap-2",
            isHomePage ? "mx-auto" : "flex-1 justify-center"
          )}>
            <img src={logo} alt="FleetTrackMate" className="h-8 w-8 rounded-lg" />
            <span className="font-heading font-semibold text-lg">Driver</span>
          </Link>
          
          {/* Spacer for centering when back button is shown */}
          {!isHomePage && <div className="w-10" />}
        </div>
      </header>

      {/* Main Content - fills available space */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation - with safe area inset for iOS */}
      <nav className="sticky bottom-0 z-30 bg-background/95 backdrop-blur border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around py-2 px-4">
          {baseNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path === '/app/dashboard' && location.pathname === '/app');
            const isSOS = item.path === '/app/sos';
            const isTasksWithBadge = item.path === '/app/tasks' && unreadCount > 0;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all",
                  isSOS && "text-destructive",
                  isActive && !isSOS && "text-primary bg-primary/10",
                  isActive && isSOS && "bg-destructive/10",
                  !isActive && !isSOS && "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn(
                    "h-5 w-5",
                    isSOS && "animate-pulse"
                  )} />
                  {isTasksWithBadge && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
