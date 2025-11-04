import HealthCheck from '../components/HealthCheck';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function Landing() {
  return (
    <section className="text-center">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="glass-card rounded-2xl p-8 md:p-12">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Real-time Fleet Tracking
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300 text-lg">
            Monitor multiple devices live on an interactive map. Built with Supabase, React, and Mapbox.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/auth/signup">
              <Button>Get Started</Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline">View Dashboard</Button>
            </Link>
          </div>
          <div className="mt-6 flex justify-center">
            <HealthCheck />
          </div>
        </div>
      </div>
    </section>
  );
}
