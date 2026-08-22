import { useState } from 'react';
import { Home, ClipboardList, AlertTriangle, Settings, MapPin, Navigation, Wallet, Camera, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'driver_onboarding_completed';

export function isOnboardingCompleted(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function markOnboardingCompleted(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

/* Each slide shows the REAL control it explains, rendered app-style. */

function NavButtonDemo({ icon: Icon, label, active = true }: { icon: typeof Home; label: string; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        'flex h-16 w-16 items-center justify-center rounded-2xl border',
        active ? 'border-primary/40 bg-accent text-primary' : 'border-border bg-card text-muted-foreground'
      )}>
        <Icon className="h-7 w-7" />
      </div>
      <span className={cn('text-xs font-semibold', active ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
    </div>
  );
}

function MapDemo() {
  return (
    <div className="relative h-40 w-full max-w-[260px] overflow-hidden rounded-2xl border border-border bg-muted/40">
      {/* roads */}
      <svg viewBox="0 0 260 160" className="absolute inset-0 h-full w-full">
        <path d="M-10,60 C60,50 120,90 270,70" fill="none" className="stroke-warning/50" strokeWidth="3" />
        <path d="M40,-10 C50,60 90,110 70,170" fill="none" className="stroke-border" strokeWidth="2" />
        <path d="M180,-10 C170,50 200,110 210,170" fill="none" className="stroke-border" strokeWidth="2" />
      </svg>
      {/* live pill */}
      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-success-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-foreground" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">Live</span>
      </div>
      {/* driver dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute -inset-3 animate-ping rounded-full bg-success/30" />
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-success shadow-lg">
          <Navigation className="h-3 w-3 text-white" />
        </span>
      </div>
    </div>
  );
}

function SOSDemo() {
  return (
    <div className="relative flex h-40 items-center justify-center">
      <span className="absolute h-32 w-32 animate-ping rounded-full bg-destructive/20" />
      <span className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-br from-destructive to-red-700 text-destructive-foreground shadow-xl shadow-destructive/40">
        <AlertTriangle className="h-10 w-10" />
        <span className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]">Hold</span>
      </span>
    </div>
  );
}

function TaskDemo() {
  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">En route</span>
      </div>
      <p className="font-heading font-bold">Deliver to Ikeja depot</p>
      <p className="telemetry mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> 4.2 km
      </p>
      <div className="mt-3 flex gap-2">
        <span className="flex h-9 flex-1 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">Navigate</span>
        <span className="flex h-9 flex-1 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">Details</span>
      </div>
    </div>
  );
}

function SettingsDemo() {
  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">On duty</p>
          <p className="text-xs text-muted-foreground">Location shared with your fleet</p>
        </div>
        <span className="flex h-6 w-11 items-center rounded-full bg-success p-0.5">
          <span className="ml-auto h-5 w-5 rounded-full bg-white shadow" />
        </span>
      </div>
    </div>
  );
}


/* The driver's own tools. Rendered in the accent colour that marks "yours"
   everywhere else in the app, so the tutorial teaches the same visual code. */
function YoursDemo({ items }: { items: { icon: typeof Home; label: string }[] }) {
  return (
    <div className="flex items-center gap-3">
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-accent"
        >
          <Icon className="h-6 w-6 text-primary" />
          <span className="text-[10px] font-semibold text-accent-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

const slides = [
  {
    demo: () => <MapDemo />,
    title: 'Home is your live map',
    description:
      'The Home tab shows where you are right now. When the green Live pill is on, your dispatcher can see you moving.',
  },
  {
    demo: () => <TaskDemo />,
    title: 'Tasks come to you',
    description:
      'The Tasks tab lists your pickups and drop-offs. Tap Navigate to drive there, and Complete when the job is done.',
  },
  {
    demo: () => <SOSDemo />,
    title: 'SOS — emergencies only',
    description:
      'The red center button sends an emergency alert with your live location to every admin. Hold it for 3 seconds — only in a real emergency.',
  },
  {
    demo: () => (
      <div className="flex items-end gap-4">
        <NavButtonDemo icon={Home} label="Home" active={false} />
        <NavButtonDemo icon={ClipboardList} label="Tasks" active={false} />
        <NavButtonDemo icon={Settings} label="Settings" />
      </div>
    ),
    title: 'Go on or off duty in Settings',
    description:
      'Settings holds your duty toggle — turn tracking on when your shift starts and off when it ends. That switch is always yours.',
  },
  {
    demo: () => (
      <YoursDemo
        items={[
          { icon: Wallet, label: 'Money' },
          { icon: Camera, label: 'Receipt' },
        ]}
      />
    ),
    title: 'Keep track of your money',
    description:
      'The Money tab is yours. Log fuel, repairs and tolls as you pay for them — photograph the receipt or upload one you already have. Your manager sees the total and approves it, and you keep the proof.',
  },
  {
    demo: () => (
      <YoursDemo
        items={[
          { icon: MapPin, label: 'Stations' },
          { icon: Camera, label: 'Proof' },
        ]}
      />
    ),
    title: 'Stations and your proof',
    description:
      'Some places you must visit show on your map. When you arrive and stay a minute it records automatically, then you take one photo as proof. That photo is your record too — Settings → My record keeps every one.',
  },
  {
    demo: () => (
      <YoursDemo
        items={[
          { icon: ShieldCheck, label: 'Check' },
          { icon: AlertTriangle, label: 'Problem' },
        ]}
      />
    ),
    title: 'Protect yourself before you drive',
    description:
      'Settings → Vehicle check lets you photograph any damage before your shift, so you are not blamed for it later. Hit a blocked road or a closed site? Report it once with a photo instead of explaining it on the phone.',
  },
  {
    demo: () => <SettingsDemo />,
    title: "You're all set",
    description:
      'Keep location on while on duty so dispatch can support you. Stay safe out there.',
  },
];

interface DriverOnboardingProps {
  onComplete: () => void;
}

export default function DriverOnboarding({ onComplete }: DriverOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isLast = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  const finish = () => {
    markOnboardingCompleted();
    onComplete();
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Skip */}
        {!isLast && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
              Skip
            </Button>
          </div>
        )}

        {/* Slide */}
        <div className="flex flex-col items-center space-y-6 text-center" key={currentSlide}>
          <div className="flex min-h-[170px] w-full items-center justify-center">{slide.demo()}</div>
          <h2 className="font-heading text-2xl font-bold">{slide.title}</h2>
          <p className="leading-relaxed text-muted-foreground">{slide.description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === currentSlide ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {/* Action */}
        <Button onClick={handleNext} className="w-full" size="lg">
          {isLast ? 'Get started' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
