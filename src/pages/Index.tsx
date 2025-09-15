import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import DashboardPreview from "@/components/DashboardPreview";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <div id="features">
          <Features />
        </div>
        <div id="dashboard">
          <DashboardPreview />
        </div>
        <div id="testimonials">
          <Testimonials />
        </div>
        <div id="pricing">
          <Pricing />
        </div>
      </main>
      <div id="contact">
        <Footer />
      </div>
    </div>
  );
};

export default Index;