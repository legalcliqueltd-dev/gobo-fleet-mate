import HealthCheck from '../components/HealthCheck';
import { Link } from 'react-router-dom';

export default function Landing() {
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
          <Link to="/auth" className="rounded-lg bg-cyan-600 text-white px-4 py-2 hover:bg-cyan-700">
            Get Started
          </Link>
          <Link to="/dashboard" className="rounded-lg border px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            View Dashboard
          </Link>
        </div>
        <div className="flex justify-center">
          <HealthCheck />
        </div>
      </div>
    </section>
  );
}
