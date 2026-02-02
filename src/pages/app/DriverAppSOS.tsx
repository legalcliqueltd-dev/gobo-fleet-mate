import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';

export default function DriverAppSOS() {
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const [sosHolding, setSosHolding] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<number | null>(null);

  const handleSOSPress = () => {
    setSosHolding(true);
    setCountdown(3);
    
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          triggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSOSRelease = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setSosHolding(false);
    setCountdown(3);
  };

  const triggerSOS = async () => {
    setSosHolding(false);
    setSending(true);

    try {
      // Get current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCurrentLocation(location);

      // Create SOS event using driver_id instead of user_id
      const { error } = await supabase.from('sos_events').insert({
        user_id: session?.driverId, // Use driver_id for code-based drivers
        latitude: location.lat,
        longitude: location.lng,
        message: message || 'Emergency SOS triggered',
        status: 'open',
      });

      if (error) throw error;

      setSosActive(true);
      toast.success('SOS alert sent! Help is on the way.');
    } catch (err: any) {
      console.error('SOS error:', err);
      toast.error('Failed to send SOS. Please try again or call emergency services.');
    } finally {
      setSending(false);
    }
  };

  const cancelSOS = async () => {
    setSosActive(false);
    setMessage('');
    toast.info('SOS cancelled');
  };

  if (sosActive) {
    return (
      <DriverAppLayout>
        <div className="p-4 h-full flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle className="h-12 w-12 text-white" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold mb-2">SOS Active</h1>
            <p className="text-muted-foreground">
              Your emergency alert has been sent. Stay calm and wait for help.
            </p>
          </div>

          {currentLocation && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-1">Your location has been shared:</p>
              <p className="text-muted-foreground font-mono text-xs">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
            </div>
          )}

          <div className="w-full max-w-xs space-y-3">
            <Button variant="outline" className="w-full gap-2" asChild>
              <a href="tel:112">
                <Phone className="h-4 w-4" />
                Call Emergency Services
              </a>
            </Button>
            
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={cancelSOS}
            >
              Cancel SOS (False Alarm)
            </Button>
          </div>
        </div>
      </DriverAppLayout>
    );
  }

  return (
    <DriverAppLayout>
      <div className="p-4 h-full flex flex-col">
        <h1 className="text-2xl font-bold mb-6 text-center">Emergency SOS</h1>

        {/* SOS Button */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <button
            onMouseDown={handleSOSPress}
            onMouseUp={handleSOSRelease}
            onMouseLeave={handleSOSRelease}
            onTouchStart={handleSOSPress}
            onTouchEnd={handleSOSRelease}
            disabled={sending}
            className={`
              relative w-40 h-40 rounded-full 
              bg-gradient-to-br from-red-500 to-red-600
              shadow-2xl transition-all duration-200
              flex items-center justify-center
              ${sosHolding ? 'scale-110 animate-pulse' : 'active:scale-95'}
              ${sending ? 'opacity-50' : ''}
            `}
          >
            <AlertTriangle className="h-16 w-16 text-white" />
            {sosHolding && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-bold text-white">{countdown}</span>
              </div>
            )}
          </button>
          
          <p className="text-center text-muted-foreground mt-4 font-medium">
            {sending ? 'Sending SOS...' : 'Hold for 3 seconds to trigger SOS'}
          </p>
        </div>

        {/* Optional Message */}
        <div className="space-y-3 mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>Add a message (optional)</span>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your emergency..."
            rows={2}
            disabled={sending}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-6 space-y-2">
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href="tel:112">
              <Phone className="h-4 w-4" />
              Call Emergency Services (112)
            </a>
          </Button>
        </div>
      </div>
    </DriverAppLayout>
  );
}
