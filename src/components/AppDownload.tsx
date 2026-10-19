import { motion } from "framer-motion";
import { ChevronRight, LayoutDashboard, Truck, KeyRound, WifiOff, Smartphone } from "lucide-react";
import logo from "@/assets/brand/trackmate-icon.svg";

/** The live store listings. One app serves drivers and managers. */
export const APP_STORE_URL = "https://apps.apple.com/us/app/fleettrackmate-driver/id6761863956";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.fleettrackmate.driver";

/** Facts, not vanity numbers. */
const FACTS = [
  { icon: Smartphone, title: "iPhone & Android", note: "One app, both stores" },
  { icon: KeyRound, title: "No password", note: "Drivers join with a code" },
  { icon: WifiOff, title: "Works offline", note: "Syncs when signal returns" },
];

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.73c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.27c.6-.73 1.01-1.75.9-2.77-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.49 2.56-1.23z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d="M4.2 2.6 13.6 12l-9.4 9.4c-.3-.2-.5-.6-.5-1.1V3.7c0-.5.2-.9.5-1.1z" fill="#00ff39" />
      <path d="m16.9 8.7-3.3 3.3 3.3 3.3 3.7-2.1c.9-.5.9-1.8 0-2.4l-3.7-2.1z" fill="#ffbf0b" />
      <path d="M4.2 2.6c.3-.2.8-.2 1.2 0l11.5 6.1-3.3 3.3L4.2 2.6z" fill="#dcebff" />
      <path d="M4.2 21.4 13.6 12l3.3 3.3-11.5 6.1c-.4.2-.9.2-1.2 0z" fill="#ffffff" />
    </svg>
  );
}

function StoreButton({ href, glyph, small, big }: { href: string; glyph: React.ReactNode; small: string; big: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-14 items-center gap-3 rounded-xl bg-[#000738] px-5 text-white shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ff39] focus-visible:ring-offset-2"
    >
      {glyph}
      <span className="text-left leading-none">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-white/70">{small}</span>
        <span className="mt-1 block text-lg font-bold">{big}</span>
      </span>
    </a>
  );
}

/**
 * The app's real first screen — "How will you use the app?" — drawn in a
 * phone frame. Built from markup rather than a screenshot so it stays sharp at
 * any size and cannot drift out of date with an old image.
 */
function PhoneMockup() {
  const choices = [
    { icon: Truck, eyebrow: "Driver app", title: "I drive", bullets: ["Join with a code", "Share your location on duty", "See jobs and send SOS"] },
    { icon: LayoutDashboard, eyebrow: "Manager portal", title: "I manage a fleet", bullets: ["Sign in with email or Google", "Track every vehicle live", "Assign jobs, handle alerts"] },
  ];
  return (
    <div className="relative mx-auto w-[290px] [perspective:1400px]" aria-hidden="true">
      <div className="rounded-[46px] bg-[#0b0f1f] p-[10px] shadow-[0_40px_80px_-30px_rgba(0,7,56,0.55)] ring-1 ring-black/10 [transform:rotateY(-14deg)_rotateX(6deg)_rotateZ(2deg)]">
        <div className="relative h-[590px] overflow-hidden rounded-[38px] bg-[#000738] text-[#dcebff]">
          <div className="brand-pattern absolute inset-0 opacity-60" />
          {/* status bar + island */}
          <div className="relative flex items-center justify-between px-7 pt-3.5 text-[12px] font-semibold">
            <span>9:41</span>
            <span className="h-6 w-24 rounded-full bg-black" />
            <span className="flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm bg-[#dcebff]" />
            </span>
          </div>

          <div className="relative flex flex-col items-center px-5 pb-6 pt-8">
            <img src={logo} alt="" className="h-12 w-12 rounded-xl" />
            <p className="mt-3 text-xl font-extrabold tracking-tight text-white">TrackMate</p>
            <p className="mt-1 text-[12px] text-[#dcebff]/70">How will you use the app?</p>
          </div>

          <div className="relative space-y-3 px-4">
            {choices.map(({ icon: Icon, eyebrow, title, bullets }, i) => (
              <div
                key={title}
                className={`rounded-2xl border p-3.5 ${i === 0 ? "border-[#00ff39]/60 bg-[#0b1550]" : "border-white/10 bg-[#0b1550]/80"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00ff39]/15 text-[#00ff39]">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#dcebff]/55">{eyebrow}</p>
                    <p className="text-[15px] font-bold leading-tight text-white">{title}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-center gap-1.5 text-[11px] text-[#dcebff]/70">
                          <span className="h-1 w-1 rounded-full bg-[#00ff39]" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[#dcebff]/50" />
                </div>
              </div>
            ))}
          </div>

          <p className="absolute inset-x-0 bottom-6 text-center text-[10px] text-[#dcebff]/50">
            You can switch modes any time from Settings.
          </p>
        </div>
      </div>
    </div>
  );
}

const AppDownload = () => {
  return (
    <section id="download" className="overflow-hidden bg-muted/40 py-20 md:py-28">
      <div className="container mx-auto grid max-w-6xl items-center gap-14 px-4 lg:grid-cols-2 lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <p className="eyebrow mb-4">Get the app</p>
          <h2 className="font-heading text-4xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
            Your whole fleet,
            <br />
            in your pocket.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            One app for both sides of the job. Drivers go on duty with a code; managers see every
            vehicle live, assign jobs and handle alerts.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <StoreButton href={APP_STORE_URL} glyph={<AppleGlyph />} small="Download on the" big="App Store" />
            <StoreButton href={PLAY_STORE_URL} glyph={<PlayGlyph />} small="Get it on" big="Google Play" />
          </div>

          <div className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-border">
            {FACTS.map(({ icon: Icon, title, note }) => (
              <div key={title} className="px-4 first:pl-0">
                <Icon className="h-6 w-6 text-foreground" />
                <p className="mt-3 text-base font-bold leading-tight">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          viewport={{ once: true }}
          className="relative"
        >
          {/* A soft dotted ground behind the phone, as in the reference. */}
          <div
            className="absolute inset-x-6 inset-y-0 rounded-3xl opacity-60"
            style={{
              backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.12) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
            aria-hidden="true"
          />
          <div className="relative py-6">
            <PhoneMockup />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AppDownload;
