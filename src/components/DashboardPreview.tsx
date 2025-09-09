import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Play } from "lucide-react";
import dashboardImage from "@/assets/dashboard-preview.jpg";

const DashboardPreview = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Dashboard
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Powerful Dashboard, Simple Interface
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Monitor your entire fleet from a single, intuitive dashboard. 
            Get real-time insights, manage vehicles, and make data-driven decisions.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="group">
              Try Dashboard
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" className="group">
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="relative max-w-6xl mx-auto">
          <Card className="overflow-hidden shadow-2xl border-0 card-gradient">
            <CardContent className="p-0">
              <div className="relative">
                <img 
                  src={dashboardImage} 
                  alt="GFTM Dashboard Preview" 
                  className="w-full h-auto rounded-lg"
                />
                
                {/* Overlay with Play Button */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg">
                  <Button size="lg" className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    <Play className="w-6 h-6 mr-2" />
                    View Interactive Demo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/20 text-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">24/7</span>
              </div>
              <h3 className="font-semibold mb-2">Real-time Monitoring</h3>
              <p className="text-muted-foreground text-sm">
                Monitor your fleet around the clock with live updates
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-success/20 text-success rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">AI</span>
              </div>
              <h3 className="font-semibold mb-2">Smart Analytics</h3>
              <p className="text-muted-foreground text-sm">
                AI-powered insights to optimize your operations
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-warning/20 text-warning rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">∞</span>
              </div>
              <h3 className="font-semibold mb-2">Unlimited Scale</h3>
              <p className="text-muted-foreground text-sm">
                Manage fleets of any size with cloud scalability
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPreview;