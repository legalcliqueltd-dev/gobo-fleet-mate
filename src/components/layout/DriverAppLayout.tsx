import { PropsWithChildren } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Settings } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { cn } from '@/lib/utils';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';

const baseNavItems = [
  { path: '/app/dashboard', icon: Home, label: 'Home' },
  { path: '/app/tasks', icon: ClipboardList, label: 'Tasks' },
  { path: '/app/sos', icon: AlertTriangle, label: 'SOS' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function DriverAppLayout({ children }: PropsWithChildren) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-center">
          <Link to="/app" className="flex items-center gap-2">
            <img src={logo} alt="FleetTrackMate" className="h-8 w-8 rounded-lg" />
            <span className="font-heading font-semibold text-lg">Driver</span>
          </Link>
        </div>
      </header>

      {/* Main Content - fills available space */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-30 bg-background/95 backdrop-blur border-t border-border safe-area-pb">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path === '/app/dashboard' && location.pathname === '/app');
            const isSOS = item.path === '/app/sos';
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all",
                  isSOS && "text-destructive",
                  isActive && !isSOS && "text-primary bg-primary/10",
                  isActive && isSOS && "bg-destructive/10",
                  !isActive && !isSOS && "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  isSOS && "animate-pulse"
                )} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
