import { PropsWithChildren, useState, useRef, useEffect } from 'react';
import { Menu, X, Home, Settings as SettingsIcon, ClipboardList, AlertTriangle, Plus } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import LocationPermissionPrompt from '../LocationPermissionPrompt';
import SOSNotificationBell from '../sos/SOSNotificationBell';
import { AlertTriangle as AlertTriangleIcon2, Timer } from 'lucide-react';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut, loading, subscription } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // Navigation items including Tasks and SOS
  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
    { path: '/ops/incidents', icon: AlertTriangle, label: 'SOS' },
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
      
      {/* Trial expiration warning banner */}
      {user && subscription.status === 'trial' && subscription.trialDaysRemaining <= 3 && subscription.trialDaysRemaining > 0 && (
        <div className="bg-warning/15 border-b border-warning/30 px-4 py-2 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Timer className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs font-medium text-warning">
              {subscription.trialDaysRemaining} day{subscription.trialDaysRemaining !== 1 ? 's' : ''} left in your free trial
            </span>
            <a href="/dashboard?upgrade=true">
              <Button variant="warning" size="sm" className="h-5 text-[10px] px-2 bg-warning text-warning-foreground hover:bg-warning/90">
                Upgrade Now
              </Button>
            </a>
          </div>
        </div>
      )}

      <header className="glass-card sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-3 xs:px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-heading font-semibold tracking-tight">
              <img src={logo} alt="FleetTrackMate" className="h-9 w-9 rounded-lg" />
              <span className="text-lg">FleetTrackMate</span>
            </Link>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <SOSNotificationBell />
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
                <SOSNotificationBell />
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
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={clsx(
                        "px-3 py-2.5 rounded-md transition flex items-center gap-3",
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      onClick={closeMobileMenu}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
                {user && (
                  <>
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
        <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
          <div
            ref={containerRef}
            className="relative flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/30 rounded-2xl px-3 py-2.5 border border-slate-200/60 dark:border-slate-700/60"
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
                    "relative flex items-center justify-center gap-2.5 px-5 py-2.5 text-sm font-medium transition-all duration-200 rounded-xl",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <Icon className="h-5 w-5 z-10" />
                  <span className="z-10 hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}

            {/* Quick Create Task Button */}
            <button
              onClick={() => navigate('/admin/tasks/new')}
              className="flex items-center justify-center p-2.5 ml-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-lg"
              title="Create Task"
            >
              <Plus className="h-5 w-5" />
            </button>

            {/* Sliding Active Indicator */}
            {activeIndex >= 0 && (
              <motion.div
                animate={indicatorStyle}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-1.5 bottom-1.5 rounded-xl bg-primary/15 dark:bg-primary/20"
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
