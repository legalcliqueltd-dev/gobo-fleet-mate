import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Smartphone, Shield, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const APK_DOWNLOAD_URL = "https://github.com/legalcliqueltd-dev/gobo-fleet-mate/releases/download/v1.0.0/FleetTrackMate.3.apk";

const AppDownload = () => {
  const steps = [
    { step: 1, title: "Download APK", description: "Click the download button below" },
    { step: 2, title: "Enable Install", description: "Allow installation from unknown sources" },
    { step: 3, title: "Install App", description: "Open the APK and tap Install" },
    { step: 4, title: "Connect", description: "Enter your admin's connection code" },
  ];

  return (
    <section id="download" className="py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            Driver App
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Download Rocket Driver
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get the mobile app for your drivers. Real-time location sharing, 
            task management, and SOS emergency features.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Download Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 h-full">
              <CardContent className="p-8 flex flex-col items-center text-center h-full">
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                  <Smartphone className="w-10 h-10 text-primary" />
                </div>
                
                <h3 className="text-2xl font-bold mb-2">Rocket Driver APK</h3>
                <p className="text-muted-foreground mb-6">
                  Android 8.0+ required • ~50MB download
                </p>

                <div className="flex flex-col gap-3 w-full max-w-xs mb-6">
                  <a href={APK_DOWNLOAD_URL} download>
                    <Button variant="hero" size="lg" className="w-full">
                      <Download className="w-5 h-5 mr-2" />
                      Download APK
                    </Button>
                  </a>
                </div>

                <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4 text-success" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-warning" />
                    <span>Fast</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Free</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Installation Steps */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Card className="border-2 border-border h-full">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-6">Installation Guide</h3>
                
                <div className="space-y-4">
                  {steps.map((item, index) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      viewport={{ once: true }}
                      className="flex items-start gap-4"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                        {item.step}
                      </div>
                      <div>
                        <h4 className="font-semibold">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-xl bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning-foreground">
                    <strong>Note:</strong> You'll need to enable "Install from unknown sources" 
                    in your Android settings to install the APK.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AppDownload;
