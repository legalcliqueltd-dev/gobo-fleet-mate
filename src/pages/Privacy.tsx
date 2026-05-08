import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Privacy = () => {
  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      content: [
        "Driver name and the connection code provided by the fleet administrator (the only personal information we ask drivers to enter).",
        "Real-time GPS location, speed, heading, and accuracy while On Duty is enabled.",
        "Photos, videos, and signatures you submit as delivery proof or SOS evidence.",
        "Device battery level and a heartbeat timestamp (every 60 seconds) so dispatchers know the device is online.",
        "Fleet administrator account: email, name, and billing email (for the web dashboard only — not collected from the driver app).",
      ],
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: [
        "Show your live position to your fleet administrator while you are On Duty.",
        "Deliver, accept, and complete tasks assigned to you by your fleet administrator.",
        "Send Emergency SOS alerts (with your location and any photo you attach) to your dispatcher.",
        "Comply with legal obligations and lawful requests when required.",
      ],
    },
    {
      icon: Lock,
      title: "How We Protect Your Information",
      content: [
        "All network requests use HTTPS / TLS in transit.",
        "Database access is gated by Supabase Row-Level Security so a driver record is only readable by the dispatcher that issued its connection code.",
        "Photo and video proofs are stored in private Supabase Storage buckets.",
        "We do not sell or share your data with advertisers, analytics services, or other third parties.",
      ],
    },
    {
      icon: UserCheck,
      title: "Your Rights",
      content: [
        "Toggle Off Duty in the app to immediately stop sharing your location.",
        "Disconnect from the fleet at any time from Settings; this clears the local session.",
        "Request deletion of your driver profile and historical data at any time (see below).",
        "Contact us with any privacy question and we will respond within 7 business days.",
      ],
    },
    {
      icon: Bell,
      title: "Data Retention",
      content: [
        "Live location is retained for trip history and reporting; older points are pruned by your fleet administrator's retention settings.",
        "SOS evidence and delivery proofs are retained until the administrator deletes them.",
        "When you request account deletion, your driver row, location history, and submitted media are permanently removed within 7 days.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            This policy explains what FleetTrackMate collects from drivers using the mobile app and from
            fleet administrators using the web dashboard, and how that information is used and protected.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Last updated: 2026-05-05</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-8">
            {sections.map((section, index) => (
              <Card key={index} className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <section.icon className="w-5 h-5 text-primary" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-12 bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Contact</h3>
              <p className="text-muted-foreground mb-4">
                If you have questions about this policy or wish to exercise any of the rights listed above,
                contact us:
              </p>
              <p className="text-sm">
                <strong>Email:</strong> gobeth.ltd@gmail.com<br />
                <strong>Operator:</strong> Gobeth Ltd
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
