import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, LayoutDashboard, ChevronRight } from 'lucide-react';
import logo from '@/assets/logo.webp';
import { useAppRole, type AppRole } from '@/contexts/AppRoleContext';

type Choice = {
  role: AppRole;
  icon: typeof Truck;
  title: string;
  subtitle: string;
  bullets: string[];
  to: string;
};

const CHOICES: Choice[] = [
  {
    role: 'driver',
    icon: Truck,
    title: 'I drive',
    subtitle: 'Driver app',
    bullets: ['Join with a code — no password', 'Share your location on duty', 'See jobs and send SOS'],
    to: '/app/driver',
  },
  {
    role: 'admin',
    icon: LayoutDashboard,
    title: 'I manage a fleet',
    subtitle: 'Manager portal',
    bullets: ['Sign in with email or Google', 'Track every vehicle live', 'Assign jobs, handle alerts'],
    to: '/app/admin',
  },
];

/**
 * First-launch fork between the two faces of the app. The choice is
 * remembered, so this screen is shown once — after that the app opens
 * straight into the chosen mode. Either Settings screen can bring the
 * user back here via "Switch mode".
 */
export default function RoleSelect() {
  const { chooseRole } = useAppRole();
  const navigate = useNavigate();

  const pick = (choice: Choice) => {
    chooseRole(choice.role);
    navigate(choice.to, { replace: true });
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background px-6"
      style={{
        paddingTop: 'max(2.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center gap-3 pb-10 pt-6"
      >
        <img src={logo} alt="" className="h-14 w-14 rounded-2xl" />
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            FleetTrackMate
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">How will you use the app?</p>
        </div>
      </motion.div>

      {/* Choices */}
      <div className="flex flex-1 flex-col justify-center gap-4 pb-6">
        {CHOICES.map((choice, index) => {
          const Icon = choice.icon;
          return (
            <motion.button
              key={choice.role}
              type="button"
              onClick={() => pick(choice)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 + index * 0.08 }}
              whileTap={{ scale: 0.985 }}
              className="group rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:border-primary"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-6 w-6" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="eyebrow mb-1">{choice.subtitle}</p>
                  <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                    {choice.title}
                  </h2>
                  <ul className="mt-3 space-y-1.5">
                    {choice.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        You can switch modes any time from Settings.
      </p>
    </div>
  );
}
