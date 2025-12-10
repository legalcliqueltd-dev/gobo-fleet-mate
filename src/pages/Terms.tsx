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
        "By accessing Fleet Track Mate, you agree to be bound by these Terms of Service",
        "If you do not agree to these terms, please do not use our services",
        "We may update these terms from time to time with reasonable notice",
        "Continued use of the service constitutes acceptance of updated terms"
      ]
    },
    {
      icon: FileText,
      title: "Service Description",
      content: [
        "Fleet Track Mate provides real-time GPS tracking and fleet management services",
        "Features include driver monitoring, geofencing, trip history, and analytics",
        "We strive for 99.9% uptime but do not guarantee uninterrupted service",
        "Features may be added, modified, or removed with prior notice"
      ]
    },
    {
      icon: Scale,
      title: "User Responsibilities",
      content: [
        "Maintain accurate and up-to-date account information",
        "Keep your login credentials secure and confidential",
        "Obtain necessary consent from drivers for location tracking",
        "Comply with all applicable local, state, and federal laws"
      ]
    },
    {
      icon: AlertTriangle,
      title: "Prohibited Activities",
      content: [
        "Unauthorized access to other users' data or accounts",
        "Use of the service for illegal surveillance or stalking",
        "Attempting to reverse engineer or hack our systems",
        "Sharing account access with unauthorized parties"
      ]
    },
    {
      icon: CreditCard,
      title: "Billing & Payments",
      content: [
        "Subscription fees are billed according to your selected plan",
        "Prices may change with 30 days advance notice",
        "Refunds are handled on a case-by-case basis",
        "Failure to pay may result in service suspension"
      ]
    },
    {
      icon: Gavel,
      title: "Limitation of Liability",
      content: [
        "FTM is provided 'as is' without warranties of any kind",
        "We are not liable for indirect, incidental, or consequential damages",
        "Our liability is limited to the amount paid for the service",
        "Some jurisdictions may not allow these limitations"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Please read these terms carefully before using Fleet Track Mate. 
            These terms govern your use of our fleet tracking platform.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Effective Date: December 10, 2025
          </p>
        </div>
      </section>

      {/* Content */}
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

          {/* Contact */}
          <Card className="mt-12 bg-muted/30">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Questions about these terms?</h3>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms of Service, please contact us.
              </p>
              <p className="text-sm">
                <strong>Email:</strong> legal@gftm.com<br />
                <strong>Address:</strong> San Francisco, CA, USA
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Terms;