import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Truck, 
  BarChart3, 
  Shield, 
  Clock, 
  Fuel, 
  AlertTriangle, 
  Users,
  Route,
  Smartphone
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: MapPin,
      title: "Real-time GPS Tracking",
      description: "Track your entire fleet in real-time with precise GPS coordinates and live location updates.",
      badge: "Live",
      color: "text-fleet-blue"
    },
    {
      icon: Route,
      title: "Route Optimization",
      description: "AI-powered route planning to reduce fuel costs, save time, and improve delivery efficiency.",
      badge: "AI Powered",
      color: "text-fleet-green"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Comprehensive reports on driver behavior, fuel consumption, and fleet performance metrics.",
      badge: "Insights",
      color: "text-primary"
    },
    {
      icon: AlertTriangle,
      title: "Smart Alerts",
      description: "Instant notifications for speeding, unauthorized use, maintenance reminders, and emergencies.",
      badge: "Instant",
      color: "text-fleet-orange"
    },
    {
      icon: Fuel,
      title: "Fuel Management",
      description: "Monitor fuel consumption, detect fuel theft, and optimize fuel efficiency across your fleet.",
      badge: "Savings",
      color: "text-fleet-green"
    },
    {
      icon: Shield,
      title: "Security & Safety",
      description: "Anti-theft protection, panic buttons, and comprehensive security features for your vehicles.",
      badge: "Secure",
      color: "text-fleet-red"
    },
    {
      icon: Users,
      title: "Driver Management",
      description: "Track driver performance, manage schedules, and improve driver behavior with detailed insights.",
      badge: "Manage",
      color: "text-primary"
    },
    {
      icon: Smartphone,
      title: "Mobile App",
      description: "Full-featured mobile apps for drivers and managers with offline capabilities.",
      badge: "Mobile",
      color: "text-fleet-blue"
    },
    {
      icon: Clock,
      title: "Maintenance Alerts",
      description: "Automated maintenance scheduling and alerts to keep your fleet running smoothly.",
      badge: "Auto",
      color: "text-fleet-orange"
    }
  ];

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Features
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything You Need to Manage Your Fleet
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comprehensive fleet management tools designed to streamline operations, 
            reduce costs, and improve efficiency across your entire fleet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 card-gradient border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-3 rounded-lg bg-background/50 ${feature.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;