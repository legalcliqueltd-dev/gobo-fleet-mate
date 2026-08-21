import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Map,
  MapPin,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Step = {
  icon: typeof Map;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
};

/**
 * Every step earns its place by answering "what is this tab for, and what is
 * the one thing I do here" — not by narrating the UI. Copy stays concrete
 * (a dump site, a receipt) because that is how the owner describes the job.
 */
const STEPS: Step[] = [
  {
    icon: UserPlus,
    eyebrow: 'Start here',
    title: 'Add a driver',
    body: 'Every driver joins with a connection code — no password, no account to set up for them.',
    points: [
      'Fleet tab → the ＋ button',
      'Name the driver or vehicle, then share the code',
      'They pick "I drive", enter the code, and appear on your map',
    ],
  },
  {
    icon: Map,
    eyebrow: 'Fleet',
    title: 'See where everyone is',
    body: 'The map is live. Green is moving, amber is parked, grey has stopped reporting.',
    points: [
      'Tap a vehicle to centre the map on it',
      'Tap the arrow beside it for that driver’s full record',
      'The counters along the top are your fleet at a glance',
    ],
  },
  {
    icon: ClipboardList,
    eyebrow: 'Jobs',
    title: 'Send work out',
    body: 'A job is a one-off delivery or errand with a drop-off point.',
    points: [
      'Search the address, or drop the pin exactly where it belongs',
      'Each job shows who holds it and how far along they are',
      'Clear completed jobs in bulk; failed ones are kept for you to review',
    ],
  },
  {
    icon: MapPin,
    eyebrow: 'Stations',
    title: 'Places they must attend',
    body: 'A station is somewhere a driver has to physically go — a dump site, a depot, a school gate — daily or on set days.',
    points: [
      'Arrival is recorded automatically once they stay inside the zone',
      'Ask for a photo receipt as proof they were really there',
      'Tap a station to see who came, when, and which days were missed',
    ],
  },
  {
    icon: AlertTriangle,
    eyebrow: 'Alerts',
    title: 'When something goes wrong',
    body: 'An SOS from any driver lands here immediately, with their location and a photo if they sent one.',
    points: [
      'See exactly where they are on the map inside the app',
      'Open Google Maps only if you are driving to them',
      'Resolve it when handled; clear old ones in bulk',
    ],
  },
  {
    icon: BarChart3,
    eyebrow: 'Insights',
    title: 'Know who did what',
    body: 'Distance, speeds and driving time over 24 hours, a week, or a month — broken down per driver.',
    points: [
      'Every total is the sum of the drivers listed below it',
      'Tap any driver to open their day-by-day history',
      'History shows trips, stops, and any period the phone went dark',
    ],
  },
];

/**
 * Guided tour of the manager portal.
 *
 * Lives behind Settings deliberately: it is a reference a manager returns to,
 * not an interruption. Nobody is made to sit through it before they can use
 * the app, and it never appears again uninvited.
 */
export default function AdminTutorial({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const Icon = step.icon;
  const isLast = index === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">
      <header
        className="flex items-center justify-between px-3 py-2.5"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
      >
        <span className="telemetry text-xs text-muted-foreground">
          {index + 1} / {STEPS.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Close tutorial"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 pb-4">
        <div className="mx-auto w-full max-w-sm">
          <span className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <Icon className="h-8 w-8 text-primary" />
          </span>

          <p className="eyebrow mb-2">{step.eyebrow}</p>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground">
            {step.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{step.body}</p>

          <ul className="mt-7 space-y-3.5">
            {step.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15">
                  <Check className="h-3 w-3 text-success" />
                </span>
                <span className="text-sm leading-relaxed text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="px-6 pb-2"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto w-full max-w-sm">
          {/* Progress dots double as direct navigation */}
          <div className="mb-4 flex justify-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to ${s.title}`}
                className="p-2"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-all',
                    i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {index > 0 && (
              <Button
                variant="outline"
                className="h-12 flex-1 gap-1.5"
                onClick={() => setIndex((i) => i - 1)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              className="h-12 flex-[2] gap-1.5 font-semibold"
              onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
