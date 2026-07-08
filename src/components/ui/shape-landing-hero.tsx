"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ── Animated route path (a road drawing itself in) ── */
function RoutePath({
  d,
  delay = 0,
  duration = 4,
  className,
}: {
  d: string;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={cn("stroke-primary/20", className)}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration, delay, ease: "easeInOut" }}
    />
  );
}

/* ── Vehicle dot travelling along a route ── */
function MovingVehicle({
  delay = 0,
  duration = 6,
  r = 4,
  pathId,
  className,
}: {
  delay?: number;
  duration?: number;
  r?: number;
  pathId: string;
  className?: string;
}) {
  return (
    <>
      {/* Halo */}
      <motion.circle
        r={r * 2.5}
        className="fill-primary/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: delay + 1 }}
      >
        <animateMotion dur={`${duration}s`} repeatCount="indefinite" begin={`${delay}s`}>
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </motion.circle>
      {/* Dot */}
      <motion.circle
        r={r}
        className={cn("fill-primary", className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.5 }}
      >
        <animateMotion dur={`${duration}s`} repeatCount="indefinite" begin={`${delay}s`}>
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </motion.circle>
    </>
  );
}

/* ── Pulsing stop pin ── */
function LocationPin({ cx, cy, delay = 0 }: { cx: number; cy: number; delay?: number }) {
  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={3}
        className="fill-primary"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={10}
        fill="none"
        className="stroke-primary/30"
        strokeWidth="1.5"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.5, 2] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: delay + 0.5 }}
      />
    </g>
  );
}

/* ── Named depot: small square marker with a mono map label ── */
function Depot({
  x,
  y,
  label,
  delay = 0,
  labelSide = "right",
}: {
  x: number;
  y: number;
  label: string;
  delay?: number;
  labelSide?: "left" | "right";
}) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay }}
    >
      <rect
        x={x - 5}
        y={y - 5}
        width={10}
        height={10}
        rx={2}
        className="fill-warning/80"
      />
      <text
        x={labelSide === "right" ? x + 14 : x - 14}
        y={y + 4}
        textAnchor={labelSide === "right" ? "start" : "end"}
        className="fill-muted-foreground font-mono"
        style={{ fontSize: "11px", letterSpacing: "0.12em" }}
      >
        {label}
      </text>
    </motion.g>
  );
}

/* ── Coordinate grid with edge tick labels ── */
function MapGrid() {
  const lats = ["6.65°N", "6.58°N", "6.52°N", "6.45°N", "6.39°N"];
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 0.2 }}>
      {[150, 300, 450, 600, 750].map((y, i) => (
        <g key={`h-${y}`}>
          <line x1="0" y1={y} x2="1440" y2={y} className="stroke-foreground/[0.05]" strokeWidth="1" />
          <text
            x="12"
            y={y - 6}
            className="fill-muted-foreground/50 font-mono"
            style={{ fontSize: "10px", letterSpacing: "0.1em" }}
          >
            {lats[i]}
          </text>
        </g>
      ))}
      {[200, 400, 600, 800, 1000, 1200].map((x) => (
        <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="900" className="stroke-foreground/[0.05]" strokeWidth="1" />
      ))}
    </motion.g>
  );
}

/* ── Signature: live telemetry feed ticker ── */
const FLEET_FEED = [
  "TRK-014 · 6.5244°N 3.3792°E · 47 km/h · en route",
  "TRK-007 · arrived IKEJA DEPOT · 14:32 WAT",
  "TRK-021 · battery 84% · signal good · on duty",
  "TRK-009 · trip complete · 42.7 km · 1 h 12 m",
  "TRK-002 · geofence exit LEKKI HUB · 09:05 WAT",
];

function TelemetryTicker() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % FLEET_FEED.length), 3000);
    return () => clearInterval(t);
  }, [reduceMotion]);

  return (
    <div className="inline-flex h-10 max-w-full items-center gap-3 overflow-hidden rounded-full border border-border/70 bg-card/70 px-4 backdrop-blur-md">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <div className="relative h-5 overflow-hidden text-left">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="telemetry truncate whitespace-nowrap text-xs text-muted-foreground sm:text-sm"
          >
            {FLEET_FEED[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function HeroGeometric({
  badge = "Fleet operations, live",
  title1 = "Every vehicle.",
  title2 = "One live map.",
  description,
  children,
}: {
  badge?: string;
  title1?: string;
  title2?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.4 + i * 0.15,
        ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
      },
    }),
  };

  return (
    <div className="relative flex min-h-[92svh] w-full items-center justify-center overflow-hidden bg-background">
      {/* Ambient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-warning/[0.05]" />

      {/* Live map canvas */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 1440 900"
          fill="none"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <path id="route1" d="M-50,350 C200,350 250,200 500,250 S750,400 900,300 S1100,150 1500,200" />
            <path id="route2" d="M-50,600 C150,550 300,700 550,650 S800,500 1050,550 S1300,700 1500,650" />
            <path id="route3" d="M200,-50 C220,150 350,200 400,400 S300,600 450,750 S600,900 650,1000" />
            <path id="route4" d="M1200,-50 C1180,100 1100,250 1050,400 S1150,550 1100,700 S1000,850 950,1000" />
          </defs>

          <MapGrid />

          {/* Main routes: amber-lit roads */}
          <RoutePath
            d="M-50,350 C200,350 250,200 500,250 S750,400 900,300 S1100,150 1500,200"
            delay={0.3}
            duration={3}
            className="stroke-warning/40"
          />
          <RoutePath
            d="M-50,600 C150,550 300,700 550,650 S800,500 1050,550 S1300,700 1500,650"
            delay={0.6}
            duration={3.5}
            className="stroke-warning/30"
          />
          {/* Cross routes: dispatch blue */}
          <RoutePath
            d="M200,-50 C220,150 350,200 400,400 S300,600 450,750 S600,900 650,1000"
            delay={0.9}
            duration={3}
            className="stroke-primary/20"
          />
          <RoutePath
            d="M1200,-50 C1180,100 1100,250 1050,400 S1150,550 1100,700 S1000,850 950,1000"
            delay={1.1}
            duration={3.5}
            className="stroke-primary/20"
          />

          {/* Faint background roads */}
          <RoutePath
            d="M-50,150 C300,180 600,100 900,180 S1200,250 1500,150"
            delay={1.3}
            duration={4}
            className="stroke-foreground/[0.06]"
          />
          <RoutePath
            d="M-50,800 C250,780 500,850 750,800 S1100,750 1500,820"
            delay={1.5}
            duration={4}
            className="stroke-foreground/[0.06]"
          />

          {/* Vehicles on the move (skipped when reduced motion is preferred) */}
          {!reduceMotion && (
            <>
              <MovingVehicle pathId="route1" delay={1} duration={8} r={4} />
              <MovingVehicle pathId="route2" delay={2.5} duration={10} r={3.5} className="fill-primary/80" />
              <MovingVehicle pathId="route3" delay={1.8} duration={9} r={3} className="fill-primary/60" />
              <MovingVehicle pathId="route4" delay={3} duration={11} r={3} className="fill-primary/70" />
            </>
          )}

          {/* Stops and depots */}
          <LocationPin cx={500} cy={250} delay={1.5} />
          <LocationPin cx={1050} cy={400} delay={3} />
          <LocationPin cx={400} cy={400} delay={3.5} />
          <Depot x={900} y={300} label="IKEJA DEPOT" delay={2.2} labelSide="left" />
          <Depot x={550} y={650} label="LEKKI HUB" delay={2.8} />
        </svg>
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div custom={0} variants={fadeUpVariants} initial="hidden" animate="visible">
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-card/70 px-4 py-1.5 backdrop-blur-md md:mb-10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {badge}
              </span>
            </div>
          </motion.div>

          <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible">
            <h1 className="mb-6 font-heading text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl md:mb-8 md:text-8xl">
              <span className="text-foreground">{title1}</span>
              <br />
              <span className="text-primary">{title2}</span>
            </h1>
          </motion.div>

          {description && (
            <motion.div custom={2} variants={fadeUpVariants} initial="hidden" animate="visible">
              <p className="mx-auto mb-8 max-w-xl px-4 text-base leading-relaxed text-muted-foreground sm:text-lg md:mb-10 md:text-xl">
                {description}
              </p>
            </motion.div>
          )}

          {children && (
            <motion.div custom={3} variants={fadeUpVariants} initial="hidden" animate="visible">
              {children}
            </motion.div>
          )}

          <motion.div custom={4} variants={fadeUpVariants} initial="hidden" animate="visible" className="mt-10 md:mt-12">
            <TelemetryTicker />
          </motion.div>
        </div>
      </div>

      {/* Bottom fade into the next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

export { HeroGeometric };
