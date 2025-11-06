import { PropsWithChildren, useState } from 'react';
import { Car, Menu, X, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={clsx('min-h-screen bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a] bg-radial')}>
      <header className="glass-card sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-3 xs:px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-heading font-semibold tracking-tight">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg nb-border bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300">
                <Car className="h-4 w-4" />
              </span>
              <span className="text-lg">FleetTrackMate</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-3 text-sm">
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <Link to="/analytics" className="hover:underline">Analytics</Link>
              <Link to="/trips" className="hover:underline">Trips</Link>
              {user && (
                <>
                  <Link 
                    to="/driver" 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-all hover:shadow-lg"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    SOS
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      More
                    </button>
                    {moreMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setMoreMenuOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 nb-card z-20 py-2">
                          <Link 
                            to="/geofences" 
                            className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setMoreMenuOpen(false)}
                          >
                            Geofences
                          </Link>
                          <Link 
                            to="/driver/tasks" 
                            className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setMoreMenuOpen(false)}
                          >
                            Tasks
                          </Link>
                          <Link 
                            to="/ops/tasks" 
                            className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setMoreMenuOpen(false)}
                          >
                            Ops
                          </Link>
                          <Link 
                            to="/settings" 
                            className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setMoreMenuOpen(false)}
                          >
                            Settings
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
              {!loading && (user ? (
                <>
                  <span className="hidden lg:inline text-slate-600 dark:text-slate-300 text-xs">{user.email}</span>
                  <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
                </>
              ) : (
                <>
                  <Link to="/auth/login" className="hover:underline">Log in</Link>
                  <Link to="/auth/signup" className="hover:underline">Sign up</Link>
                </>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-2 md:hidden">
              {user && (
                <Link 
                  to="/driver"
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                >
                  <AlertTriangle className="h-3 w-3" />
                  SOS
                </Link>
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
      <main className="mx-auto max-w-7xl px-3 xs:px-4 py-6 md:py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-3 xs:px-4 py-8 text-xs text-slate-500">
        © {new Date().getFullYear()} FleetTrackMate
      </footer>
    </div>
  );
}
