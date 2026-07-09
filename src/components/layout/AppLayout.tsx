import { PropsWithChildren, useState } from 'react';
import { Menu, X, Home, Settings as SettingsIcon, ClipboardList, AlertTriangle, Plus } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LocationPermissionPrompt from '@/components/LocationPermissionPrompt';
import SOSNotificationBell from '@/components/sos/SOSNotificationBell';
import BackButton from '@/components/ui/BackButton';
import { AlertTriangle as AlertTriangleIcon2, Timer } from 'lucide-react';

// Routes where the back button should NOT appear (top-level destinations)
const NO_BACK_ROUTES = new Set([
  '/',
  '/dashboard',
  '/admin',
  '/admin/dashboard',
]);

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut, loading, subscription } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation items including Tasks and SOS
  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
    { path: '/ops/incidents', icon: AlertTriangle, label: 'SOS' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-background bg-radial">
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
              <Button variant="warning" size="sm" className="h-6 text-[11px] px-2.5">
                Upgrade now
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

            {/* Desktop navigation */}
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={clsx(
                        'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <Button
                  variant="default"
                  size="sm"
                  className="ml-2"
                  onClick={() => navigate('/admin/tasks/new')}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New task
                </Button>
              </nav>
            )}

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
                className="p-2 hover:bg-muted rounded-md transition"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-border pt-4 animate-fade-in">
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
                          : "hover:bg-muted"
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
                    <div className="border-t border-border my-2"></div>
                    <div className="px-3 py-2 text-sm text-muted-foreground">{user.email}</div>
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
                      className="px-3 py-2 hover:bg-muted rounded-md transition"
                      onClick={closeMobileMenu}
                    >
                      Log in
                    </Link>
                    <Link
                      to="/auth/signup"
                      className="px-3 py-2 hover:bg-muted rounded-md transition"
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
      <main className="mx-auto max-w-7xl px-3 xs:px-4 pt-6 md:pt-8 pb-28 md:pb-12">
        {user && !NO_BACK_ROUTES.has(location.pathname) && (
          <div className="mb-3">
            <BackButton />
          </div>
        )}
        {children}
      </main>
      
      {/* Bottom navigation — mobile only; desktop uses the header nav */}
      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur safe-bottom">
          <div className="flex items-center px-2 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className={clsx('text-[11px]', isActive ? 'font-semibold' : 'font-medium')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => navigate('/admin/tasks/new')}
              className="mx-1 flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-primary"
              aria-label="Create a new task"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium">New</span>
            </button>
          </div>
        </nav>
      )}

      <footer className="mx-auto max-w-7xl px-3 xs:px-4 py-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} FleetTrackMate
      </footer>
    </div>
  );
}
