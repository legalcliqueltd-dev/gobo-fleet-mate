import { useState, useRef } from 'react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Phone, MessageSquare, Camera, X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { isNativePlatform, capturePhotoAsFile } from '@/utils/nativeCamera';

type Hazard = 'accident' | 'medical' | 'robbery' | 'breakdown' | 'other';

export default function DriverAppSOS() {
  const { session } = useDriverSession();
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
          // Update SOS with photo URL via edge function or direct update
          await supabase.from('sos_events').update({ photo_url: photoUrl }).eq('id', data.sosId);
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
        <h1 className="text-2xl font-bold mb-4 text-center">Emergency SOS</h1>

        {/* SOS Button */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <button
            onMouseDown={handleSOSPress}
            onMouseUp={handleSOSRelease}
            onMouseLeave={handleSOSRelease}
            onTouchStart={handleSOSPress}
            onTouchEnd={handleSOSRelease}
            disabled={sending}
            className={
              `relative w-40 h-40 rounded-full bg-gradient-to-br from-red-500 to-red-600 ` +
              `shadow-2xl transition-all duration-200 flex items-center justify-center ` +
              `${sosHolding ? 'scale-110 animate-pulse' : 'active:scale-95'} ` +
              `${sending ? 'opacity-50' : ''}`
            }
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

        {/* Hazard Type Selection */}
        <div className="space-y-3 mt-4">
          <label className="block text-sm font-medium">Hazard Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['accident', 'medical', 'robbery', 'breakdown', 'other'] as Hazard[]).map((h) => (
              <button
                key={h}
                onClick={() => setHazard(h)}
                className={
                  `px-2 py-2 rounded-lg border text-xs font-medium transition ` +
                  (hazard === h
                    ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'border-border hover:border-red-500/50')
                }
              >
                {h.charAt(0).toUpperCase() + h.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Photo Evidence */}
        <div className="space-y-3 mt-4">
          <label className="block text-sm font-medium">Photo Evidence (Optional)</label>
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="w-full max-h-32 object-cover rounded-lg" />
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCameraCapture}
                disabled={sending || uploadingPhoto}
              >
                <Camera className="h-4 w-4 mr-2" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleGallerySelect}
                disabled={sending || uploadingPhoto}
              >
                <Image className="h-4 w-4 mr-2" />
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
        <div className="space-y-3 mt-4">
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
        <div className="mt-4 space-y-2">
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
