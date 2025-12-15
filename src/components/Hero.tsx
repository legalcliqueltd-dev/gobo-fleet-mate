import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Truck, BarChart3, Download } from "lucide-react";
import { motion } from "framer-motion";

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full text-foreground/5"
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

const Hero = () => {
  const words = ["Fleet", "Track", "Mate"];

  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Animated Background Paths */}
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Animated Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-8 tracking-tighter">
            {words.map((word, wordIndex) => (
              <span
                key={wordIndex}
                className="inline-block mr-2 sm:mr-4 last:mr-0"
              >
                {word.split("").map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.03,
                      type: "spring",
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block text-transparent bg-clip-text 
                    bg-gradient-to-r from-foreground to-foreground/80"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed px-4"
          >
            Advanced cloud-based fleet tracking and management solution. 
            Monitor your vehicles in real-time, optimize routes, and boost efficiency.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 md:mb-8 px-4"
          >
            <div className="inline-block group relative bg-gradient-to-b from-primary/10 to-primary/5 
              p-px rounded-xl backdrop-blur-lg overflow-hidden shadow-lg hover:shadow-xl 
              transition-shadow duration-300"
            >
              <a href="/auth/signup">
                <Button
                  variant="hero"
                  size="lg"
                  className="rounded-[0.7rem] group-hover:-translate-y-0.5 transition-transform w-full sm:w-auto"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </div>
            <a href="#download">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Download className="w-5 h-5 mr-2" />
                Download Driver Tracker App
              </Button>
            </a>
          </motion.div>

          {/* Feature Icons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="flex flex-wrap justify-center gap-4 md:gap-8 text-muted-foreground mb-8 px-4"
          >
            <div className="flex items-center gap-2 text-sm md:text-base">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <span>Real-time Tracking</span>
            </div>
            <div className="flex items-center gap-2 text-sm md:text-base">
              <Truck className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <span>Fleet Management</span>
            </div>
            <div className="flex items-center gap-2 text-sm md:text-base">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <span>Analytics & Reports</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
