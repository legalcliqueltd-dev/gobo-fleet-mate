import { PropsWithChildren } from 'react';
import { Car, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className={clsx('min-h-screen bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a]')}>
      <header className="backdrop-blur-md bg-white/50 dark:bg-slate-900/50 border-b border-white/20 dark:border-slate-800 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Car className="h-5 w-5 text-cyan-500" />
            <span>FleetTrackMate</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="hover:underline">Sign in</Link>
                <Link to="/auth/signup" className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-slate-500">
        © {new Date().getFullYear()} FleetTrackMate
      </footer>
    </div>
  );
}
