import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <HeroGeometric
      badge="Cloud-Based Fleet Management"
      title1="Real-time Fleet"
      title2="Tracking"
      description="Monitor multiple devices live on an interactive map. Built with Supabase, React, and Google Maps."
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/auth/signup">
          <Button variant="hero" size="lg" className="group">
            Get Started
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="outline" size="lg">
            View Dashboard
          </Button>
        </Link>
      </div>
    </HeroGeometric>
  );
}
