import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote } from "lucide-react";

const Testimonials = () => {
  const testimonials = [
    {
      name: "Sarah Johnson",
      company: "Express Logistics Inc.",
      role: "Fleet Manager",
      content: "FleetTracker has revolutionized our operations. We've reduced fuel costs by 23% and improved delivery times significantly. The real-time tracking gives us complete visibility.",
      rating: 5,
      avatar: "SJ"
    },
    {
      name: "Michael Chen",
      company: "Urban Delivery Co.",
      role: "Operations Director",
      content: "The maintenance scheduling feature alone has saved us thousands. We catch issues before they become expensive problems. Best investment we've made.",
      rating: 5,
      avatar: "MC"
    },
    {
      name: "Amanda Rodriguez",
      company: "Metro Transport",
      role: "CEO",
      content: "Driver behavior monitoring has improved safety scores across our entire fleet. Insurance costs dropped 15% after just 6 months of using FleetTracker.",
      rating: 5,
      avatar: "AR"
    }
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Testimonials
          </Badge>
          <h2 className="text-4xl font-bold mb-4 gradient-text">
            Trusted by Fleet Managers Worldwide
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how businesses like yours are transforming their fleet operations with our platform
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="relative card-gradient border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
              <CardContent className="p-8">
                <div className="absolute -top-3 left-8">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Quote className="h-6 w-6 text-primary" />
                  </div>
                </div>
                
                <div className="pt-4">
                  {/* Rating */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Content */}
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">500+</div>
            <div className="text-sm text-muted-foreground">Happy Customers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">50K+</div>
            <div className="text-sm text-muted-foreground">Vehicles Tracked</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">25%</div>
            <div className="text-sm text-muted-foreground">Average Cost Savings</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;