import { PropsWithChildren } from 'react';
import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, signOut, loading } = useAuth();

  return (
    <div className={clsx('min-h-screen bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a]')}>
      <header className="backdrop-blur-md bg-white/50 dark:bg-slate-900/50 border-b border-white/20 dark:border-slate-800 sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Car className="h-5 w-5 text-cyan-500" />
            <span>FleetTrackMate</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="hover:underline">Dashboard</Link>
            {!loading && (user ? (
              <>
                <span className="text-slate-600 dark:text-slate-300">{user.email}</span>
                <button onClick={signOut} className="rounded-md border px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">Sign out</button>
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
