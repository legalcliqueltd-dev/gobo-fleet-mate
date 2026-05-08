import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, Scale, CreditCard, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Terms = () => {
  const sections = [
    {
      icon: CheckCircle,
      title: "Acceptance of Terms",
      content: [
        "By using FleetTrackMate (the driver mobile app or the fleet administrator web dashboard) you agree to these Terms.",
        "If you do not agree, do not use the service.",
        "We may update these Terms; continued use after a notice of changes constitutes acceptance.",
      ],
    },
    {
      icon: FileText,
      title: "Service Description",
      content: [
        "FleetTrackMate provides a fleet administrator web dashboard for tracking, dispatching, and reporting on vehicles and drivers.",
        "FleetTrackMate Driver is a free companion mobile app used by drivers, who connect using a code issued by their fleet administrator.",
        "We aim for high availability but do not guarantee uninterrupted service.",
      ],
    },
    {
      icon: Scale,
      title: "User Responsibilities",
      content: [
        "Fleet administrators must obtain consent from their drivers before tracking them, and must comply with applicable employment and privacy laws.",
        "Drivers should only use the app while their vehicle is stationary; do not interact with the screen while driving.",
        "Keep your account credentials confidential; you are responsible for activity under your account.",
      ],
    },
    {
      icon: AlertTriangle,
      title: "Prohibited Activities",
      content: [
        "Tracking individuals without their consent or for any unlawful purpose.",
        "Reverse engineering or attempting to disrupt the service.",
        "Sharing administrator account access with unauthorized third parties.",
        "Submitting false delivery proofs or SOS reports.",
      ],
    },
    {
      icon: CreditCard,
      title: "Billing & Subscriptions",
      content: [
        "The driver mobile app is free.",
        "Fleet administrator subscriptions are sold and billed exclusively on the FleetTrackMate web dashboard.",
        "Subscriptions auto-renew until cancelled. You can cancel at any time from the web dashboard; cancellation takes effect at the end of the current billing period.",
        "Refund requests are reviewed on a case-by-case basis. Failure to pay may result in suspension of the web dashboard for that account; the driver mobile app remains free.",
      ],
    },
    {
      icon: Gavel,
      title: "Limitation of Liability",
      content: [
        "FleetTrackMate is provided 'as is' without warranties of any kind.",
        "We are not liable for indirect, incidental, or consequential damages.",
        "Our aggregate liability is limited to the fees you have paid us in the prior 12 months.",
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
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Please read these terms before using FleetTrackMate. They govern both the driver app and
            the administrator web dashboard.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Effective: 2026-05-05</p>
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
                Questions about these Terms? Reach the operator:
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

export default Terms;
