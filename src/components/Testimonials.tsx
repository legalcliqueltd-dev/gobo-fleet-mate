import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Johnson",
    company: "Express Logistics Inc.",
    role: "Fleet Manager",
    content:
      "FleetTrackMate has revolutionized our operations. We've reduced fuel costs by 23% and improved delivery times significantly. The real-time tracking gives us complete visibility.",
    rating: 5,
    avatar: "SJ",
  },
  {
    name: "Michael Chen",
    company: "Urban Delivery Co.",
    role: "Operations Director",
    content:
      "The maintenance scheduling feature alone has saved us thousands. We catch issues before they become expensive problems. Best investment we've made.",
    rating: 5,
    avatar: "MC",
  },
  {
    name: "Amanda Rodriguez",
    company: "Metro Transport",
    role: "CEO",
    content:
      "Driver behavior monitoring has improved safety scores across our entire fleet. Insurance costs dropped 15% after just 6 months of using FleetTrackMate.",
    rating: 5,
    avatar: "AR",
  },
];

const stats = [
  { value: "500+", label: "Fleets on board" },
  { value: "50K+", label: "Vehicles tracked" },
  { value: "25%", label: "Avg. cost savings" },
  { value: "99.9%", label: "Uptime" },
];

const Testimonials = () => {
  return (
    <section className="bg-muted/40 py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center md:mb-16">
          <p className="eyebrow mb-4 justify-center">Testimonials</p>
          <h2 className="mb-4 font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Trusted by the people who run fleets
          </h2>
          <p className="text-lg text-muted-foreground">
            See how businesses like yours are transforming their fleet operations.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="flex flex-col rounded-xl border border-border bg-card p-7 transition-colors hover:border-primary/40"
            >
              <div className="mb-4 flex gap-1" aria-label={`${testimonial.rating} out of 5 stars`}>
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                ))}
              </div>

              <blockquote className="mb-6 flex-1 leading-relaxed text-muted-foreground">
                “{testimonial.content}”
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t border-border pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-heading font-semibold text-accent-foreground">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold leading-tight">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Fleet-wide numbers, set like a console readout */}
        <div className="mx-auto mt-14 max-w-4xl">
          <div className="grid grid-cols-2 divide-border rounded-xl border border-border bg-card md:grid-cols-4 md:divide-x">
            {stats.map((stat) => (
              <div key={stat.label} className="px-6 py-6 text-center">
                <div className="telemetry text-2xl font-semibold text-primary md:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
