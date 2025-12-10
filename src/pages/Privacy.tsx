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
        "Account information (name, email, phone number)",
        "Device and vehicle location data for fleet tracking purposes",
        "Usage data and analytics to improve our services",
        "Communication preferences and support interactions"
      ]
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: [
        "Provide real-time fleet tracking and management services",
        "Send notifications about driver status and geofence events",
        "Improve and optimize our platform features",
        "Comply with legal obligations and protect our rights"
      ]
    },
    {
      icon: Lock,
      title: "Data Security",
      content: [
        "End-to-end encryption for all data transmission",
        "SOC 2 compliant infrastructure and processes",
        "Regular security audits and penetration testing",
        "Secure data centers with 24/7 monitoring"
      ]
    },
    {
      icon: UserCheck,
      title: "Your Rights",
      content: [
        "Access and download your personal data",
        "Request correction of inaccurate information",
        "Delete your account and associated data",
        "Opt-out of marketing communications"
      ]
    },
    {
      icon: Bell,
      title: "Cookies & Tracking",
      content: [
        "Essential cookies for platform functionality",
        "Analytics cookies to understand usage patterns",
        "You can manage cookie preferences in your browser",
        "We do not sell your data to third parties"
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
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your privacy matters to us. This policy explains how Fleet Track Mate collects, 
            uses, and protects your personal information.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: December 10, 2025
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
              <h3 className="font-semibold mb-2">Questions about privacy?</h3>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, please contact us.
              </p>
              <p className="text-sm">
                <strong>Email:</strong> privacy@gftm.com<br />
                <strong>Address:</strong> San Francisco, CA, USA
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Privacy;