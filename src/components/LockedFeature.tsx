import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentWall from './PaymentWall';

interface LockedFeatureProps {
  children: React.ReactNode;
  featureName?: string;
}

export default function LockedFeature({ children, featureName }: LockedFeatureProps) {
  const { hasFullAccess } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);

  if (hasFullAccess) {
    return <>{children}</>;
  }

  return (
    <>
      {showPaywall && <PaymentWall onDismiss={() => setShowPaywall(false)} />}
      <div className="relative rounded-xl overflow-hidden">
        <div className="blur-sm pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
          <div className="p-2 rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {featureName || 'This feature'} requires a subscription
          </p>
          <Button variant="hero" size="sm" className="h-7 text-xs" onClick={() => setShowPaywall(true)}>
            Upgrade to Unlock
          </Button>
        </div>
      </div>
    </>
  );
}
