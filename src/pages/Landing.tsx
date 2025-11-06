import HealthCheck from '../components/HealthCheck';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function Landing() {
  return (
    <section className="text-center">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="glass-card rounded-2xl p-6 md:p-10">
          <h1 className="font-heading font-bold [font-size:clamp(28px,6vw,52px)] leading-tight">
            Real-time Fleet Tracking
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300 text-base md:text-lg">
            Monitor multiple devices live on an interactive map. Built with Supabase, React, and Mapbox.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/auth/signup">
              <Button variant="brutal">Get Started</Button>
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
