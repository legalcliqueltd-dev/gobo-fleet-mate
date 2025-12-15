import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Download } from 'lucide-react';
import AppDownload from '@/components/AppDownload';
import Pricing from '@/components/Pricing';

export default function Landing() {
  return (
    <div className="space-y-10 md:space-y-14">
      <HeroGeometric
        badge="Cloud-Based Fleet Management"
        title1="Real-time Fleet"
        title2="Tracking"
        description="Monitor multiple devices live on an interactive map. Built with Supabase, React, and Google Maps."
      >
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link to="/auth/signup">
            <Button variant="hero" size="lg" className="group">
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <a href="#download">
            <Button variant="outline" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Download Driver Tracker App
            </Button>
          </a>
        </div>
      </HeroGeometric>

      <AppDownload />

      <div id="pricing">
        <Pricing />
      </div>
    </div>
  );
}
