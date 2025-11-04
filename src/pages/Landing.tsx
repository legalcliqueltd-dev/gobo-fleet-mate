import HealthCheck from '../components/HealthCheck';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Landing() {
  const { user } = useAuth();

  return (
    <section className="text-center">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Real-time Fleet Tracking
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          Monitor multiple devices live on an interactive map. Built with Supabase, React, and Mapbox.
        </p>
        <div className="flex justify-center gap-3">
          {user ? (
            <Link to="/dashboard" className="rounded-lg bg-cyan-600 text-white px-4 py-2 hover:bg-cyan-700">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/auth/signup" className="rounded-lg bg-cyan-600 text-white px-4 py-2 hover:bg-cyan-700">
                Get Started
              </Link>
              <Link to="/auth/login" className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                Sign In
              </Link>
            </>
          )}
        </div>
        <div className="flex justify-center">
          <HealthCheck />
        </div>
      </div>
    </section>
  );
}
