import { useState, useRef } from 'react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertTriangle,
  Phone,
  MessageSquare,
  Camera,
  X,
  Image,
  CarFront,
  HeartPulse,
  ShieldAlert,
  Wrench,
  CircleHelp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { isNativePlatform, capturePhotoAsFile } from '@/utils/nativeCamera';
import { useEmergencyContact } from '@/hooks/useEmergencyContact';

type Hazard = 'accident' | 'medical' | 'robbery' | 'breakdown' | 'other';

const HAZARDS: { value: Hazard; label: string; icon: typeof CarFront }[] = [
  { value: 'accident', label: 'Accident', icon: CarFront },
  { value: 'medical', label: 'Medical', icon: HeartPulse },
  { value: 'robbery', label: 'Robbery', icon: ShieldAlert },
  { value: 'breakdown', label: 'Breakdown', icon: Wrench },
  { value: 'other', label: 'Other', icon: CircleHelp },
];

/* Hold-to-trigger ring dimensions */
const RING_SIZE = 208;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function DriverAppSOS() {
  const { session } = useDriverSession();
  const { contact: emergencyContact } = useEmergencyContact(session?.driverId, session?.adminCode);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [hazard, setHazard] = useState<Hazard>('other');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const [sosHolding, setSosHolding] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const countdownRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const processPhotoFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be less than 5MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPhotoFile(file);
  };

  const handleCameraCapture = async () => {
    if (isNativePlatform()) {
      try {
        const file = await capturePhotoAsFile('camera');
        if (file) processPhotoFile(file);
      } catch (error: any) {
        toast.error(error.message || 'Failed to capture photo');
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleGallerySelect = async () => {
    if (isNativePlatform()) {
      try {
        const file = await capturePhotoAsFile('gallery');
        if (file) processPhotoFile(file);
      } catch (error: any) {
        toast.error(error.message || 'Failed to select photo');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  const uploadPhoto = async (sosId: string): Promise<string | null> => {
    if (!photoFile || !session?.driverId) return null;

    setUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `${session.driverId}/${sosId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('sos-evidence')
        .upload(fileName, photoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Photo upload error:', error);
        toast.error('Failed to upload photo');
        return null;
      }

      const { data: urlData } = supabase.storage.from('sos-evidence').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Photo upload exception:', err);
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const triggerSOS = async () => {
    setSosHolding(false);
    setSending(true);

    try {
      if (!session?.driverId || !session?.adminCode) {
        toast.error('Not connected to a fleet. Please reconnect first.');
        return;
      }

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

      // Use edge function to bypass RLS for code-based drivers
      const { data, error } = await supabase.functions.invoke('sos-create', {
        body: {
          driverId: session.driverId,
          adminCode: session.adminCode,
          latitude: location.lat,
          longitude: location.lng,
          message: message || 'Emergency SOS triggered',
          hazard: hazard,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create SOS');

      // Upload photo if provided
      if (photoFile && data.sosId) {
        const photoUrl = await uploadPhoto(data.sosId);
        if (photoUrl) {
          // Update SOS with photo URL via edge function (bypasses RLS)
          await supabase.functions.invoke('connect-driver', {
            body: {
              action: 'update-sos-photo',
              driverId: session.driverId,
              adminCode: session.adminCode,
              sosId: data.sosId,
              photoUrl,
            },
          });
        }
      }

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
    setHazard('other');
    removePhoto();
    toast.info('SOS cancelled');
  };

  if (sosActive) {
    return (
      <DriverAppLayout>
        <div className="flex h-full flex-col items-center justify-center space-y-6 p-4 text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
            <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-destructive shadow-lg shadow-destructive/40">
              <AlertTriangle className="h-12 w-12 text-destructive-foreground" />
            </span>
          </div>

          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
              Alert sent
            </p>
            <h1 className="mb-2 font-heading text-3xl font-bold">SOS active</h1>
            <p className="text-muted-foreground">
              Your emergency alert has been sent. Stay calm and wait for help.
            </p>
          </div>

          {currentLocation && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="mb-1 font-medium">Location shared with your fleet:</p>
              <p className="telemetry text-xs text-muted-foreground">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
            </div>
          )}

          <div className="w-full max-w-xs space-y-3">
            {emergencyContact ? (
              <Button variant="outline" size="lg" className="w-full gap-2" asChild>
                <a href={`tel:${emergencyContact.phone}`}>
                  <Phone className="h-4 w-4" />
                  Call {emergencyContact.name || 'Emergency Contact'} ({emergencyContact.phone})
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="lg" className="w-full gap-2" disabled>
                <Phone className="h-4 w-4" />
                Emergency contact not set — ask your dispatcher
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={cancelSOS}
            >
              Cancel SOS (false alarm)
            </Button>
          </div>
        </div>
      </DriverAppLayout>
    );
  }

  return (
    <DriverAppLayout>
      <div className="flex h-full flex-col p-4">
        <div className="mb-2 text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
            Emergency
          </p>
          <h1 className="font-heading text-2xl font-bold">SOS</h1>
        </div>

        {/* SOS hold button with progress ring */}
        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <button
            onMouseDown={handleSOSPress}
            onMouseUp={handleSOSRelease}
            onMouseLeave={handleSOSRelease}
            onTouchStart={handleSOSPress}
            onTouchEnd={handleSOSRelease}
            disabled={sending}
            aria-label="Hold for 3 seconds to send an SOS alert"
            className={cn(
              'relative flex items-center justify-center rounded-full transition-transform duration-200 select-none touch-none',
              sosHolding ? 'scale-105' : 'active:scale-95',
              sending && 'opacity-50'
            )}
            style={{ width: RING_SIZE, height: RING_SIZE }}
          >
            {/* Progress ring: fills over the 3-second hold */}
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="absolute inset-0 -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_STROKE}
                className="stroke-destructive/20"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                className="stroke-destructive"
                style={{
                  strokeDasharray: RING_CIRCUMFERENCE,
                  strokeDashoffset: sosHolding ? 0 : RING_CIRCUMFERENCE,
                  transition: sosHolding
                    ? 'stroke-dashoffset 3s linear'
                    : 'stroke-dashoffset 0.2s ease-out',
                }}
              />
            </svg>

            {/* Button face */}
            <span
              className={cn(
                'flex flex-col items-center justify-center rounded-full bg-gradient-to-br from-destructive to-red-700 text-destructive-foreground shadow-2xl shadow-destructive/40',
                sosHolding && 'animate-pulse'
              )}
              style={{ width: RING_SIZE - 28, height: RING_SIZE - 28 }}
            >
              {sosHolding ? (
                <span className="telemetry text-6xl font-bold">{countdown}</span>
              ) : (
                <>
                  <AlertTriangle className="h-14 w-14" />
                  <span className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.2em]">
                    Hold
                  </span>
                </>
              )}
            </span>
          </button>

          <p className="mt-4 text-center font-medium text-muted-foreground">
            {sending ? 'Sending SOS…' : 'Hold for 3 seconds to send the alert'}
          </p>
        </div>

        {/* Hazard type */}
        <div className="mt-2 space-y-3">
          <label className="eyebrow">What's happening?</label>
          <div className="grid grid-cols-3 gap-2">
            {HAZARDS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setHazard(value)}
                aria-pressed={hazard === value}
                className={cn(
                  'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition',
                  hazard === value
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border bg-card text-muted-foreground hover:border-destructive/50'
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Evidence */}
        <div className="space-y-3 mt-5">
          <label className="eyebrow">Photo evidence (optional)</label>
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="max-h-32 w-full rounded-lg object-cover" />
              <button
                onClick={removePhoto}
                aria-label="Remove photo"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition hover:bg-destructive/90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-[44px]"
                onClick={handleCameraCapture}
                disabled={sending || uploadingPhoto}
              >
                <Camera className="mr-2 h-4 w-4" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-[44px]"
                onClick={handleGallerySelect}
                disabled={sending || uploadingPhoto}
              >
                <Image className="mr-2 h-4 w-4" />
                Gallery
              </Button>
            </div>
          )}

          {/* Hidden inputs for web fallback */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Optional Message */}
        <div className="space-y-3 mt-5">
          <label className="eyebrow">
            <MessageSquare className="h-3.5 w-3.5" />
            Message (optional)
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your emergency…"
            rows={2}
            disabled={sending}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-5 space-y-2 pb-2">
          {emergencyContact ? (
            <Button variant="outline" size="lg" className="w-full gap-2" asChild>
              <a href={`tel:${emergencyContact.phone}`}>
                <Phone className="h-4 w-4" />
                Call {emergencyContact.name || 'Emergency Contact'} ({emergencyContact.phone})
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="lg" className="w-full gap-2" disabled>
              <Phone className="h-4 w-4" />
              Emergency contact not set — ask your dispatcher
            </Button>
          )}
        </div>
      </div>
    </DriverAppLayout>
  );
}
