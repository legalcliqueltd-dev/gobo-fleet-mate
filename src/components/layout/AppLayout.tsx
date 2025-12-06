import { PropsWithChildren, useState, useRef, useEffect } from 'react';
import { Car, Menu, X, MoreHorizontal, AlertTriangle, Home, TrendingUp, MapPin, Users, Settings as SettingsIcon, Link2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import LocationPermissionPrompt from '../LocationPermissionPrompt';
import { useBackgroundLocationTracking } from '@/hooks/useBackgroundLocationTracking';
import SOSNotificationBell from '../sos/SOSNotificationBell';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const location = useLocation();
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // Background location tracking with user preferences
  const locationEnabled = localStorage.getItem('locationTrackingEnabled') !== 'false';
  const updateInterval = parseInt(localStorage.getItem('locationUpdateInterval') || '30000');
  const batterySaving = localStorage.getItem('batterySavingMode') === 'true';

  const { isTracking, batteryLevel } = useBackgroundLocationTracking(!!user && locationEnabled, {
    updateIntervalMs: updateInterval,
    enableHighAccuracy: true,
    batterySavingMode: batterySaving,
  });

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/analytics', icon: TrendingUp, label: 'Analytics' },
    { path: '/trips', icon: MapPin, label: 'Trips' },
    { path: '/geofences', icon: Users, label: 'Geofences' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const activeIndex = navItems.findIndex(item => location.pathname.startsWith(item.path));

  // Update indicator position when active changes or resize
  useEffect(() => {
    const updateIndicator = () => {
      if (activeIndex >= 0 && btnRefs.current[activeIndex] && containerRef.current) {
        const btn = btnRefs.current[activeIndex];
        const container = containerRef.current;
        if (!btn) return;
        const btnRect = btn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setIndicatorStyle({
          width: btnRect.width,
          left: btnRect.left - containerRect.left,
        });
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeIndex]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={clsx('min-h-screen bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a] bg-radial')}>
      {user && <LocationPermissionPrompt />}
      <header className="glass-card sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-3 xs:px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-heading font-semibold tracking-tight">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg nb-border bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300">
                <Car className="h-4 w-4" />
              </span>
              <span className="text-lg">FleetTrackMate</span>
            </Link>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <>
                  <SOSNotificationBell />
                  <Link 
                    to="/driver" 
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-all hover:shadow-lg"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    SOS
                  </Link>
                </>
              )}
              {!loading && (user ? (
                <>
                  <span className="hidden lg:inline text-muted-foreground text-xs py-2">{user.email}</span>
                  <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
                </>
              ) : (
                <>
                  <Link to="/auth/login">
                    <Button variant="ghost" size="sm">Log in</Button>
                  </Link>
                  <Link to="/auth/signup">
                    <Button variant="default" size="sm">Sign up</Button>
                  </Link>
                </>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-2 md:hidden">
              {user && (
                <>
                  <SOSNotificationBell />
                  <Link 
                    to="/driver"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    SOS
                  </Link>
                </>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-white/10 dark:border-slate-800/60 pt-4 animate-fade-in">
              <div className="flex flex-col gap-2">
                <Link 
                  to="/dashboard" 
                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/analytics" 
                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                  onClick={closeMobileMenu}
                >
                  Analytics
                </Link>
                <Link 
                  to="/trips" 
                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                  onClick={closeMobileMenu}
                >
                  Trips
                </Link>
                <Link 
                  to="/geofences" 
                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                  onClick={closeMobileMenu}
                >
                  Geofences
                </Link>
                {user && (
                  <>
                    <Link 
                      to="/driver/tasks" 
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      onClick={closeMobileMenu}
                    >
                      My Tasks
                    </Link>
                    <Link 
                      to="/ops/tasks" 
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      onClick={closeMobileMenu}
                    >
                      Ops Console
                    </Link>
                    <Link 
                      to="/settings" 
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      onClick={closeMobileMenu}
                    >
                      Settings
                    </Link>
                    <Link 
                      to="/temp-tracking" 
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition flex items-center gap-2"
                      onClick={closeMobileMenu}
                    >
                      <Link2 className="h-4 w-4" />
                      Temp Tracking
                    </Link>
                    <div className="border-t border-white/10 dark:border-slate-800/60 my-2"></div>
                    <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400">{user.email}</div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { signOut(); closeMobileMenu(); }}
                      className="mx-3"
                    >
                      Sign out
                    </Button>
                  </>
                )}
                {!loading && !user && (
                  <>
                    <Link 
                      to="/auth/login" 
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      onClick={closeMobileMenu}
                    >
                      Log in
                    </Link>
                    <Link 
                      to="/auth/signup" 
                      className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      onClick={closeMobileMenu}
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 xs:px-4 py-6 md:py-8 mb-24">{children}</main>
      
      {/* Floating Navigation - Desktop */}
      {user && (
        <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div
            ref={containerRef}
            className="relative flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg shadow-lg rounded-full px-2 py-1 border border-slate-200/50 dark:border-slate-700/50"
          >
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  ref={(el) => (btnRefs.current[index] = el)}
                  className={clsx(
                    "relative flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 text-sm font-medium transition-colors rounded-full",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 z-10" />
                  <span className="text-xs z-10 hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}

            {/* Sliding Active Indicator */}
            {activeIndex >= 0 && (
        <motion.div
          animate={indicatorStyle}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute top-0.5 bottom-0.5 rounded-full bg-primary/15 dark:bg-primary/25"
        />
            )}
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-7xl px-3 xs:px-4 py-8 text-xs text-slate-500">
        © {new Date().getFullYear()} FleetTrackMate
      </footer>
    </div>
  );
}
