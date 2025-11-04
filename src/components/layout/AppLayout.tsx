import { PropsWithChildren } from 'react';
import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle';
import Button from '../ui/Button';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut, loading } = useAuth();

  return (
    <div className={clsx('min-h-screen bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a] bg-radial')}>
      <header className="glass-card sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-cyan-600 text-white"><Car className="h-4 w-4" /></span>
            <span>FleetTrackMate</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="hover:underline">Dashboard</Link>
            <ThemeToggle />
            {!loading && (user ? (
              <>
                <span className="hidden sm:inline text-slate-600 dark:text-slate-300">{user.email}</span>
                <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="hover:underline">Log in</Link>
                <Link to="/auth/signup" className="hover:underline">Sign up</Link>
              </>
            ))}
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
