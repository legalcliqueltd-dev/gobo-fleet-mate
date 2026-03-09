"use client";

import { motion } from "framer-motion";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Animated route/road paths ── */
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

/* ── Moving dot along a route ── */
function MovingVehicle({
  delay = 0,
  duration = 6,
  cx,
  cy,
  r = 4,
  pathId,
  className,
}: {
  delay?: number;
  duration?: number;
  cx?: number;
  cy?: number;
  r?: number;
  pathId: string;
  className?: string;
}) {
  return (
    <>
      {/* Glow */}
      <motion.circle
        r={r * 2.5}
        className="fill-primary/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: delay + 1 }}
      >
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        >
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
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        >
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </motion.circle>
    </>
  );
}

/* ── Pulsing location pin ── */
function LocationPin({
  cx,
  cy,
  delay = 0,
}: {
  cx: number;
  cy: number;
  delay?: number;
}) {
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

/* ── Subtle grid overlay ── */
function MapGrid() {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2, delay: 0.2 }}
    >
      {/* Horizontal lines */}
      {[150, 300, 450, 600, 750].map((y) => (
        <line
          key={`h-${y}`}
          x1="0"
          y1={y}
          x2="1440"
          y2={y}
          className="stroke-primary/[0.04]"
          strokeWidth="1"
        />
      ))}
      {/* Vertical lines */}
      {[200, 400, 600, 800, 1000, 1200].map((x) => (
        <line
          key={`v-${x}`}
          x1={x}
          y1="0"
          x2={x}
          y2="900"
          className="stroke-primary/[0.04]"
          strokeWidth="1"
        />
      ))}
    </motion.g>
  );
}

function HeroGeometric({
  badge = "Design Collective",
  title1 = "Elevate Your Digital Vision",
  title2 = "Crafting Exceptional Websites",
  description,
  children,
}: {
  badge?: string;
  title1?: string;
  title2?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
      },
    }),
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background">
      {/* Ambient gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-primary/[0.08] blur-3xl" />

      {/* Animated map/tracking background */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          viewBox="0 0 1440 900"
          fill="none"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Route paths for vehicles to follow */}
            <path
              id="route1"
              d="M-50,350 C200,350 250,200 500,250 S750,400 900,300 S1100,150 1500,200"
            />
            <path
              id="route2"
              d="M-50,600 C150,550 300,700 550,650 S800,500 1050,550 S1300,700 1500,650"
            />
            <path
              id="route3"
              d="M200,-50 C220,150 350,200 400,400 S300,600 450,750 S600,900 650,1000"
            />
            <path
              id="route4"
              d="M1200,-50 C1180,100 1100,250 1050,400 S1150,550 1100,700 S1000,850 950,1000"
            />
          </defs>

          {/* Grid */}
          <MapGrid />

          {/* Animated route paths (roads) */}
          <RoutePath d="M-50,350 C200,350 250,200 500,250 S750,400 900,300 S1100,150 1500,200" delay={0.3} duration={3} />
          <RoutePath d="M-50,600 C150,550 300,700 550,650 S800,500 1050,550 S1300,700 1500,650" delay={0.6} duration={3.5} />
          <RoutePath d="M200,-50 C220,150 350,200 400,400 S300,600 450,750 S600,900 650,1000" delay={0.9} duration={3} className="stroke-primary/15" />
          <RoutePath d="M1200,-50 C1180,100 1100,250 1050,400 S1150,550 1100,700 S1000,850 950,1000" delay={1.1} duration={3.5} className="stroke-primary/15" />

          {/* Secondary faint routes */}
          <RoutePath d="M-50,150 C300,180 600,100 900,180 S1200,250 1500,150" delay={1.3} duration={4} className="stroke-primary/[0.08]" />
          <RoutePath d="M-50,800 C250,780 500,850 750,800 S1100,750 1500,820" delay={1.5} duration={4} className="stroke-primary/[0.08]" />

          {/* Moving vehicles */}
          <MovingVehicle pathId="route1" delay={1} duration={8} r={4} />
          <MovingVehicle pathId="route2" delay={2.5} duration={10} r={3.5} className="fill-primary/80" />
          <MovingVehicle pathId="route3" delay={1.8} duration={9} r={3} className="fill-primary/60" />
          <MovingVehicle pathId="route4" delay={3} duration={11} r={3} className="fill-primary/70" />

          {/* Location pins at key points */}
          <LocationPin cx={500} cy={250} delay={1.5} />
          <LocationPin cx={900} cy={300} delay={2} />
          <LocationPin cx={550} cy={650} delay={2.5} />
          <LocationPin cx={1050} cy={400} delay={3} />
          <LocationPin cx={400} cy={400} delay={3.5} />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/[0.05] border border-primary/20 mb-8 md:mb-12"
          >
            <Circle className="h-2 w-2 fill-primary/80" />
            <span className="text-sm text-muted-foreground tracking-wide">
              {badge}
            </span>
          </motion.div>

          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80">
                {title1}
              </span>
              <br />
              <span
                className={cn(
                  "bg-clip-text text-transparent bg-gradient-to-r from-primary via-foreground/90 to-fleet-blue"
                )}
              >
                {title2}
              </span>
            </h1>
          </motion.div>

          {description && (
            <motion.div
              custom={2}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed font-light tracking-wide max-w-2xl mx-auto px-4">
                {description}
              </p>
            </motion.div>
          )}

          {children && (
            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>

      {/* Top/bottom fade overlay for blending */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/80 pointer-events-none" />
    </div>
  );
}

export { HeroGeometric };
