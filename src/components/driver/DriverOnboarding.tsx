import { useState } from 'react';
import { MapPin, AlertTriangle, ClipboardList, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'driver_onboarding_completed';

const slides = [
  {
    icon: ClipboardList,
    title: 'Welcome!',
    description: 'Accept trips assigned to you from the dashboard. Your dispatcher will send tasks directly to your device.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: MapPin,
    title: 'Keep Location ON',
    description: 'Always keep your location enabled so dispatchers can track you in real-time and assign nearby tasks.',
    color: 'text-[hsl(var(--fleet-green))]',
    bg: 'bg-[hsl(var(--fleet-green))]/10',
  },
  {
    icon: AlertTriangle,
    title: 'SOS — Emergencies Only',
    description: 'Use the SOS button ONLY in genuine emergencies — your admin and emergency contacts will be alerted immediately.',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  {
    icon: Rocket,
    title: "You're All Set!",
    description: "Tap 'Get Started' to begin your shift. Stay safe out there!",
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
];

interface DriverOnboardingProps {
  onComplete: () => void;
}

export function isOnboardingCompleted(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function markOnboardingCompleted(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

export default function DriverOnboarding({ onComplete }: DriverOnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isLast = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];
  const Icon = slide.icon;

  const handleNext = () => {
    if (isLast) {
      markOnboardingCompleted();
      onComplete();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    markOnboardingCompleted();
    onComplete();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full space-y-8">
        {/* Skip button */}
        {!isLast && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip
            </Button>
          </div>
        )}

        {/* Slide content */}
        <div
          className="flex flex-col items-center text-center space-y-6 transition-all duration-300 ease-in-out"
          key={currentSlide}
        >
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center', slide.bg)}>
            <Icon className={cn('h-10 w-10', slide.color)} />
          </div>
          <h2 className="text-2xl font-bold">{slide.title}</h2>
          <p className="text-muted-foreground leading-relaxed">{slide.description}</p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === currentSlide ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {/* Action button */}
        <Button onClick={handleNext} className="w-full" size="lg">
          {isLast ? 'Get Started' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
