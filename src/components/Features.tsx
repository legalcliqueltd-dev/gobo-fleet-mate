import {
  MapPin,
  Route,
  BarChart3,
  CircleDot,
  ClipboardList,
  Siren,
} from "lucide-react";

const features = [
  {
    icon: MapPin,
    tag: "MAP",
    title: "Live tracking",
    description:
      "Watch every driver move on one map — speed, heading and battery, updated as it happens.",
  },
  {
    icon: ClipboardList,
    tag: "TASKS",
    title: "Task dispatch",
    description:
      "Assign pickups and drop-offs to drivers, with photo and signature proof on completion.",
  },
  {
    icon: CircleDot,
    tag: "ZONES",
    title: "Geofence alerts",
    description:
      "Draw zones around depots and customers. Get an alert the moment a vehicle enters or leaves.",
  },
  {
    icon: Route,
    tag: "TRIPS",
    title: "Trip history",
    description:
      "Every journey recorded — distance, duration and route — ready to replay whenever you need it.",
  },
  {
    icon: Siren,
    tag: "SOS",
    title: "SOS response",
    description:
      "One tap sends an emergency alert with live location to every admin. Built for driver safety.",
  },
  {
    icon: BarChart3,
    tag: "REPORTS",
    title: "Fleet analytics",
    description:
      "Distance, active hours and utilisation per driver — see where the fleet's time actually goes.",
  },
];

const Features = () => {
  return (
    <section className="py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center md:mb-16">
          <p className="eyebrow mb-4 justify-center">Features</p>
          <h2 className="mb-4 font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Run the whole fleet from one console
          </h2>
          <p className="text-lg text-muted-foreground">
            Each feature maps to a screen your team already understands — no training courses, no
            hardware installers.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.tag}
                className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted-foreground/70">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mb-1.5 font-heading text-xl font-semibold group-hover:text-primary">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
