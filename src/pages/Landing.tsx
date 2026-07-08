import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Download } from 'lucide-react';
import AppDownload from '@/components/AppDownload';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import Pricing from '@/components/Pricing';
import Footer from '@/components/Footer';

export default function Landing() {
  return (
    <div className="space-y-10 md:space-y-14">
      <HeroGeometric
        badge="Fleet operations, live"
        title1="Every vehicle."
        title2="One live map."
        description="FleetTrackMate puts your whole fleet on a live map — driver locations, trips, geofences and SOS alerts, updated in real time."
      >
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link to="/auth/signup">
            <Button variant="hero" size="lg" className="group">
              Start tracking free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <a href="#download">
            <Button variant="outline" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Get the driver app
            </Button>
          </a>
        </div>
      </HeroGeometric>

      <AppDownload />

      <div id="features">
        <Features />
      </div>

      <div id="testimonials">
        <Testimonials />
      </div>

      <div id="pricing">
        <Pricing />
      </div>

      <Footer />
    </div>
  );
}
