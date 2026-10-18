import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import heroPhone from '@/assets/hero-phone.webp';

/*
 * The landing hero. Its colours are pinned, not themed: the phone art is an
 * opaque cutout on #fffef8 cream with the hand bleeding off its bottom-right
 * edge, so the ground has to be that exact cream in both themes and the
 * image has to sit flush in the corner. Navy and neon are pinned with it so
 * the lockup reads the same whatever the visitor's theme.
 */
const CREAM = 'bg-[#fffef8]';
const NAVY = 'text-[#000738]';

export default function LandingHero() {
  const reduceMotion = useReducedMotion();

  const rise = (i: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay: 0.1 + i * 0.12, ease: [0.25, 0.4, 0.25, 1] as const },
        };

  return (
    <section
      className={`relative flex w-full flex-col overflow-hidden ${CREAM} ${NAVY} lg:h-[100svh] lg:max-h-[900px] lg:min-h-[640px] lg:flex-row lg:items-center`}
    >
      <div className="container relative z-10 mx-auto px-4 pt-24 md:px-6 lg:pt-0">
        <div className="max-w-xl lg:max-w-[40rem] lg:pl-[4%]">
          <motion.h1
            {...rise(0)}
            className="font-heading text-[clamp(2.9rem,11vw,4rem)] font-extrabold leading-[0.98] tracking-[-0.02em] lg:text-[clamp(4rem,6.4vw,5.6rem)]"
          >
            Every Vehicle.
            <br />
            One live{' '}
            <span className="inline-block bg-[#000738] px-[0.14em] pb-[0.1em] text-signal">map.</span>
          </motion.h1>

          <motion.p {...rise(1)} className="mt-8 max-w-md text-lg lg:max-w-[36rem] leading-relaxed text-[#000738]/85 md:text-xl lg:mt-12">
            See all your Fleet from one place, without the phone calls.
          </motion.p>

          <motion.div {...rise(2)} className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-7 lg:mt-24">
            <Link
              to="/auth/signup"
              className="inline-flex h-[52px] items-center justify-center rounded-lg bg-signal px-7 text-lg font-semibold text-[#000738] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#000738] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffef8] sm:w-60"
            >
              Start tracking free
            </Link>
            <a
              href="#download"
              className="inline-flex h-[52px] items-center justify-center rounded-lg border border-[#000738] px-7 text-lg font-semibold text-[#000738] transition-colors hover:bg-[#000738] hover:text-[#fffef8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#000738] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffef8] sm:w-60"
            >
              Get the driver app
            </a>
          </motion.div>
        </div>
      </div>

      <motion.img
        src={heroPhone}
        alt=""
        aria-hidden="true"
        width={580}
        height={768}
        initial={reduceMotion ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
        className="mt-10 ml-auto block w-[min(88%,26rem)] select-none lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:h-full lg:w-auto"
        draggable={false}
      />
    </section>
  );
}
