import { Button } from "@/components/ui/button";
import { Download, Smartphone, Shield, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { ShareAppButton } from "@/components/ShareAppButton";

const APK_DOWNLOAD_URL = "https://fleettrackmate.com/downloads/FleetTrackMate.apk";

const steps = [
  { number: "01", title: "Download the APK", description: "Use the download button on this page." },
  { number: "02", title: "Allow the install", description: "Approve installs from unknown sources when Android asks." },
  { number: "03", title: "Install the app", description: "Open the downloaded file and tap Install." },
  { number: "04", title: "Connect", description: "Enter your name and the connection code from your admin." },
];

const AppDownload = () => {
  return (
    <section id="download" className="bg-muted/40 py-20 md:py-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <p className="eyebrow mb-4 justify-center">Driver app</p>
          <h2 className="mb-4 font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Put the tracker in every cab
          </h2>
          <p className="text-lg text-muted-foreground">
            Drivers install one app, enter a code, and go on duty. Location sharing, tasks and SOS —
            no account or password needed.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Download card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <div className="flex h-full flex-col items-center rounded-xl border border-border bg-card p-8 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent">
                <Smartphone className="h-10 w-10 text-accent-foreground" />
              </div>

              <h3 className="mb-2 font-heading text-2xl font-bold">FleetTrackMate Driver</h3>
              <p className="telemetry mb-6 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Android 8.0+ · ~50 MB · APK
              </p>

              <div className="mb-6 flex w-full max-w-xs flex-col gap-3">
                <a href={APK_DOWNLOAD_URL} download>
                  <Button variant="hero" size="lg" className="w-full">
                    <Download className="mr-2 h-5 w-5" />
                    Download APK
                  </Button>
                </a>
                <ShareAppButton variant="outline" size="lg" className="w-full" />
              </div>

              <div className="mt-auto flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-success" />
                  Secure
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-warning" />
                  Light on battery
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Always free
                </span>
              </div>
            </div>
          </motion.div>

          {/* Install steps */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <div className="h-full rounded-xl border border-border bg-card p-8">
              <h3 className="mb-6 font-heading text-xl font-bold">Install in four steps</h3>

              <ol className="space-y-5">
                {steps.map((step) => (
                  <li key={step.number} className="flex items-start gap-4">
                    <span className="mt-0.5 font-mono text-sm font-medium text-primary">
                      {step.number}
                    </span>
                    <div>
                      <h4 className="font-semibold leading-tight">{step.title}</h4>
                      <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8 rounded-lg border border-warning/30 bg-warning/10 p-4">
                <p className="text-sm text-foreground">
                  <strong>Heads up:</strong> Android will ask you to allow installs from unknown
                  sources the first time. That's normal for apps installed outside the Play Store.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AppDownload;
