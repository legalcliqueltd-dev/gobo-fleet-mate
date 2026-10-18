import LandingHero from '@/components/LandingHero';
import AppDownload from '@/components/AppDownload';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import Pricing from '@/components/Pricing';
import Footer from '@/components/Footer';

export default function Landing() {
  return (
    <div className="space-y-10 md:space-y-14">
      <LandingHero />

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
