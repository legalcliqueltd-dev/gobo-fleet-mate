import { Truck, Mail, Phone, MapPin } from "lucide-react";
import HealthCheck from "@/components/HealthCheck";
import { useLocation, Link } from "react-router-dom";

const footerSections = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Driver app", href: "#download" },
      { name: "System status", href: "/status", isRoute: true },
    ],
  },
  {
    title: "Support",
    links: [
      { name: "Contact support", href: "mailto:support@fleettrackmate.com" },
      { name: "Delete account", href: "/delete-account", isRoute: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy policy", href: "/privacy", isRoute: true },
      { name: "Terms of service", href: "/terms", isRoute: true },
    ],
  },
];

const Footer = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Truck className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold leading-tight">FleetTrackMate</h3>
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  Fleet tracking console
                </p>
              </div>
            </div>

            <p className="mb-6 max-w-sm leading-relaxed text-muted-foreground">
              Live GPS tracking, dispatch and driver safety for fleets of any size — on the web and
              in the cab.
            </p>

            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:+447341011220" className="hover:text-foreground">
                  +44 734 1011 220
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:support@fleettrackmate.com" className="hover:text-foreground">
                  support@fleettrackmate.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-primary" />
                <span>United Kingdom</span>
              </li>
            </ul>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    {link.isRoute ? (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.name}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.name}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} FleetTrackMate. All rights reserved.</p>
          <p className="font-mono text-xs uppercase tracking-[0.15em]">
            Made for fleet managers
          </p>
        </div>
      </div>

      {/* Health check — landing page only */}
      {isLandingPage && <HealthCheck />}
    </footer>
  );
};

export default Footer;
