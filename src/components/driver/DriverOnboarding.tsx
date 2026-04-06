import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'driver_onboarding_completed';

// SVG Illustrations as inline components
const WelcomeIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Phone body */}
    <rect x="55" y="20" width="90" height="160" rx="14" fill="#1e293b" stroke="#0ea5e9" strokeWidth="2"/>
    <rect x="62" y="38" width="76" height="120" rx="4" fill="#0f172a"/>
    {/* Screen content - task list */}
    <rect x="70" y="48" width="60" height="10" rx="3" fill="#0ea5e9" opacity="0.8"/>
    <rect x="70" y="66" width="50" height="6" rx="2" fill="#334155"/>
    <rect x="70" y="76" width="54" height="6" rx="2" fill="#334155"/>
    <rect x="70" y="90" width="50" height="6" rx="2" fill="#334155"/>
    <rect x="70" y="100" width="44" height="6" rx="2" fill="#334155"/>
    {/* Checkmark circles */}
    <circle cx="134" cy="69" r="6" fill="#10b981"/>
    <path d="M131 69l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="134" cy="93" r="6" fill="#10b981"/>
    <path d="M131 93l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Pending circle */}
    <circle cx="134" cy="103" r="6" stroke="#475569" strokeWidth="1.5" fill="none"/>
    {/* Notch */}
    <rect x="85" y="24" width="30" height="6" rx="3" fill="#0f172a"/>
    {/* Home indicator */}
    <rect x="85" y="168" width="30" height="4" rx="2" fill="#475569"/>
    {/* Decorative elements */}
    <circle cx="40" cy="50" r="4" fill="#0ea5e9" opacity="0.3"/>
    <circle cx="165" cy="140" r="6" fill="#0ea5e9" opacity="0.2"/>
    <circle cx="155" cy="45" r="3" fill="#10b981" opacity="0.4"/>
  </svg>
);

const LocationIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Phone body */}
    <rect x="55" y="20" width="90" height="160" rx="14" fill="#1e293b" stroke="#0ea5e9" strokeWidth="2"/>
    <rect x="62" y="38" width="76" height="120" rx="4" fill="#0f172a"/>
    {/* Map background */}
    <rect x="62" y="38" width="76" height="120" rx="4" fill="#1a2332"/>
    {/* Map grid lines */}
    <line x1="62" y1="68" x2="138" y2="68" stroke="#1e3a4f" strokeWidth="0.5"/>
    <line x1="62" y1="98" x2="138" y2="98" stroke="#1e3a4f" strokeWidth="0.5"/>
    <line x1="62" y1="128" x2="138" y2="128" stroke="#1e3a4f" strokeWidth="0.5"/>
    <line x1="85" y1="38" x2="85" y2="158" stroke="#1e3a4f" strokeWidth="0.5"/>
    <line x1="115" y1="38" x2="115" y2="158" stroke="#1e3a4f" strokeWidth="0.5"/>
    {/* Map pin */}
    <path d="M100 75c-8 0-14 6-14 14 0 10 14 22 14 22s14-12 14-22c0-8-6-14-14-14z" fill="#0ea5e9"/>
    <circle cx="100" cy="89" r="5" fill="#0f172a"/>
    {/* Pulse rings */}
    <circle cx="100" cy="98" r="18" stroke="#0ea5e9" strokeWidth="1.5" opacity="0.5" fill="none">
      <animate attributeName="r" from="18" to="35" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="100" cy="98" r="18" stroke="#0ea5e9" strokeWidth="1" opacity="0.3" fill="none">
      <animate attributeName="r" from="18" to="45" dur="2s" begin="0.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.3" to="0" dur="2s" begin="0.5s" repeatCount="indefinite"/>
    </circle>
    {/* Notch */}
    <rect x="85" y="24" width="30" height="6" rx="3" fill="#0f172a"/>
    {/* Home indicator */}
    <rect x="85" y="168" width="30" height="4" rx="2" fill="#475569"/>
    {/* Signal waves top-right */}
    <path d="M158 35c4-4 10-4 14 0" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M160 30c6-6 14-6 20 0" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
    <path d="M162 25c8-8 18-8 26 0" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3"/>
  </svg>
);

const SOSIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Large SOS button */}
    <circle cx="100" cy="95" r="55" fill="#7f1d1d" opacity="0.3"/>
    <circle cx="100" cy="95" r="45" fill="#991b1b"/>
    <circle cx="100" cy="95" r="38" fill="#dc2626"/>
    {/* SOS Text */}
    <text x="100" y="88" textAnchor="middle" fill="white" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="22">SOS</text>
    <text x="100" y="108" textAnchor="middle" fill="white" fontFamily="Inter, sans-serif" fontWeight="400" fontSize="9" opacity="0.8">EMERGENCY</text>
    {/* Alert waves */}
    <circle cx="100" cy="95" r="55" stroke="#dc2626" strokeWidth="2" opacity="0.6" fill="none">
      <animate attributeName="r" from="55" to="75" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="100" cy="95" r="55" stroke="#dc2626" strokeWidth="1.5" opacity="0.4" fill="none">
      <animate attributeName="r" from="55" to="80" dur="1.5s" begin="0.4s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" begin="0.4s" repeatCount="indefinite"/>
    </circle>
    {/* Finger pressing icon */}
    <path d="M100 155c0 0-4-8-4-14 0-4 2-6 4-6s4 2 4 6c0 6-4 14-4 14z" fill="#cbd5e1" opacity="0.6"/>
    <circle cx="100" cy="138" r="5" fill="#cbd5e1" opacity="0.4"/>
    {/* Warning triangles */}
    <path d="M38 50l5 9H33l5-9z" fill="#fbbf24" opacity="0.6"/>
    <path d="M162 50l5 9h-10l5-9z" fill="#fbbf24" opacity="0.6"/>
    {/* Small alert icons */}
    <text x="38" y="48" textAnchor="middle" fill="#fbbf24" fontSize="8" opacity="0.5">!</text>
    <text x="162" y="48" textAnchor="middle" fill="#fbbf24" fontSize="8" opacity="0.5">!</text>
  </svg>
);

const GetStartedIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Road */}
    <path d="M75 190 L90 80 L100 30 L110 80 L125 190" fill="#334155"/>
    <path d="M95 180 L98 120" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round"/>
    <path d="M99 100 L100 60" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round"/>
    {/* Rocket */}
    <path d="M100 25c-8 10-10 20-10 30h20c0-10-2-20-10-30z" fill="#0ea5e9"/>
    <rect x="93" y="55" width="14" height="20" rx="2" fill="#1e293b"/>
    <circle cx="100" cy="62" r="4" fill="#0ea5e9" opacity="0.8"/>
    {/* Rocket fins */}
    <path d="M90 65l-6 12h6z" fill="#0ea5e9" opacity="0.7"/>
    <path d="M110 65l6 12h-6z" fill="#0ea5e9" opacity="0.7"/>
    {/* Rocket flame */}
    <path d="M96 75c0 0 2 10 4 12 2-2 4-12 4-12z" fill="#f97316"/>
    <path d="M97 75c0 0 1.5 6 3 8 1.5-2 3-8 3-8z" fill="#fbbf24"/>
    {/* Stars / sparkles */}
    <circle cx="50" cy="40" r="2" fill="white" opacity="0.6"/>
    <circle cx="150" cy="55" r="2" fill="white" opacity="0.6"/>
    <circle cx="45" cy="80" r="1.5" fill="white" opacity="0.4"/>
    <circle cx="160" cy="90" r="1.5" fill="white" opacity="0.4"/>
    <circle cx="55" cy="120" r="1" fill="white" opacity="0.3"/>
    <circle cx="145" cy="130" r="1" fill="white" opacity="0.3"/>
    {/* Speed lines */}
    <line x1="85" y1="85" x2="80" y2="100" stroke="#0ea5e9" strokeWidth="1" opacity="0.3" strokeLinecap="round"/>
    <line x1="115" y1="85" x2="120" y2="100" stroke="#0ea5e9" strokeWidth="1" opacity="0.3" strokeLinecap="round"/>
    <line x1="82" y1="95" x2="75" y2="115" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.2" strokeLinecap="round"/>
    <line x1="118" y1="95" x2="125" y2="115" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.2" strokeLinecap="round"/>
    {/* Checkmark badge */}
    <circle cx="155" cy="35" r="10" fill="#10b981"/>
    <path d="M150 35l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const slides = [
  {
    illustration: WelcomeIllustration,
    title: 'Welcome!',
    description: 'Accept trips assigned to you from the dashboard. Your dispatcher will send tasks directly to your device.',
  },
  {
    illustration: LocationIllustration,
    title: 'Keep Location ON',
    description: 'Always keep your location enabled so dispatchers can track you in real-time and assign nearby tasks.',
  },
  {
    illustration: SOSIllustration,
    title: 'SOS — Emergencies Only',
    description: 'Use the SOS button ONLY in genuine emergencies — your admin and emergency contacts will be alerted immediately.',
  },
  {
    illustration: GetStartedIllustration,
    title: "You're All Set!",
    description: "Tap 'Get Started' to begin your shift. Stay safe out there!",
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
  const Illustration = slide.illustration;

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
          <div className="w-[200px] h-[200px] flex items-center justify-center">
            <Illustration />
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
