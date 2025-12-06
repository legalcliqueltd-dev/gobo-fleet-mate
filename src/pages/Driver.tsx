import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Camera, MapPin, X, Upload, Image } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

type Hazard = 'accident' | 'medical' | 'robbery' | 'breakdown' | 'other';

export default function Driver() {
  const { user } = useAuth();
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showForm, setShowForm] = useState(false);
  const [hazard, setHazard] = useState<Hazard>('other');
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recentSOS, setRecentSOS] = useState<any>(null);
  const [positionInterval, setPositionInterval] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const holdTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.error('Location error:', err);
          toast.error('Could not get your location');
        }
      );
    }

    // Load most recent SOS for this user
    loadRecentSOS();

    // Subscribe to updates for this user's SOS events
    const channel = supabase
      .channel('driver-sos-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sos_events',
        },
        (payload) => {
          if (payload.new && recentSOS && payload.new.id === recentSOS.id) {
            setRecentSOS(payload.new);
            if (payload.new.status === 'acknowledged') {
              toast.success('Your SOS has been acknowledged! Help is on the way.');
            } else if (payload.new.status === 'resolved') {
              toast.success('Your SOS has been resolved.');
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (positionInterval) clearInterval(positionInterval);
      supabase.removeChannel(channel);
    };
  }, [recentSOS?.id]);

  const loadRecentSOS = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sos_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setRecentSOS(data);
  };

  const handleMouseDown = () => {
    setHolding(true);
    setCountdown(2);
    
    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setHolding(false);
          setShowForm(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleMouseUp = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setHolding(false);
    setCountdown(2);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
  };

  const uploadPhoto = async (sosId: string): Promise<string | null> => {
    if (!photoFile || !user) return null;
    
    setUploadingPhoto(true);
    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${user.id}/${sosId}/${Date.now()}.${fileExt}`;
      
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

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('sos-evidence')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Photo upload exception:', err);
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submitSOS = async () => {
    if (!user || !location) {
      toast.error('Location required');
      return;
    }

    setSubmitting(true);
    try {
      // First create the SOS event without photo
      const { data, error } = await supabase
        .from('sos_events')
        .insert({
          user_id: user.id,
          hazard,
          message: message || null,
          latitude: location.lat,
          longitude: location.lng,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      // Upload photo if present and update SOS with URL
      if (photoFile && data) {
        const photoUrl = await uploadPhoto(data.id);
        if (photoUrl) {
          await supabase
            .from('sos_events')
            .update({ photo_url: photoUrl })
            .eq('id', data.id);
          data.photo_url = photoUrl;
        }
      }

      toast.success('SOS sent! Help is on the way.');
      setShowForm(false);
      setMessage('');
      removePhoto();
      setRecentSOS(data);

      // Start auto-updating position every 30 seconds for 10 minutes
      startPositionUpdates(data.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send SOS');
    } finally {
      setSubmitting(false);
    }
  };

  const startPositionUpdates = (sosId: string) => {
    let count = 0;
    const maxUpdates = 20; // 20 updates x 30s = 10 minutes

    const interval = window.setInterval(() => {
      if (count >= maxUpdates) {
        clearInterval(interval);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await supabase.from('sos_position_updates').insert({
            sos_event_id: sosId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => console.error('Position update error:', err)
      );

      count++;
    }, 30000); // 30 seconds

    setPositionInterval(interval);
  };

  const cancelSOS = async () => {
    if (!recentSOS) return;
    const { error } = await supabase
      .from('sos_events')
      .update({ status: 'cancelled' })
      .eq('id', recentSOS.id);
    
    if (!error) {
      toast.success('SOS cancelled');
      setRecentSOS({ ...recentSOS, status: 'cancelled' });
      if (positionInterval) clearInterval(positionInterval);
    }
  };

  const statusColor = {
    open: 'bg-red-500',
    acknowledged: 'bg-yellow-500',
    resolved: 'bg-green-500',
    cancelled: 'bg-gray-500',
  };

  const statusText = {
    open: 'Waiting for response...',
    acknowledged: 'Help is on the way!',
    resolved: 'Resolved',
    cancelled: 'Cancelled',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-heading text-3xl font-bold mb-6">Driver Emergency</h1>

      {recentSOS && recentSOS.status !== 'resolved' && recentSOS.status !== 'cancelled' && (
        <div className="glass-card p-4 mb-6 border-2 border-red-500/50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Active SOS</h3>
            <span className={`px-3 py-1 rounded-full text-white text-sm ${statusColor[recentSOS.status as keyof typeof statusColor]}`}>
              {recentSOS.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            Hazard: <strong>{recentSOS.hazard}</strong>
          </p>
          <p className="text-sm font-medium mb-2 text-primary">
            {statusText[recentSOS.status as keyof typeof statusText]}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {new Date(recentSOS.created_at).toLocaleString()}
          </p>
          {recentSOS.photo_url && (
            <div className="mb-4">
              <img
                src={recentSOS.photo_url}
                alt="Evidence"
                className="w-full max-h-48 object-cover rounded-lg"
              />
            </div>
          )}
          {recentSOS.status === 'open' && (
            <Button variant="outline" size="sm" onClick={cancelSOS}>
              Cancel SOS
            </Button>
          )}
        </div>
      )}

      {!showForm ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            className={`relative w-64 h-64 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white font-bold text-2xl shadow-2xl transition-transform ${
              holding ? 'scale-95' : 'scale-100 hover:scale-105'
            } active:scale-95 flex flex-col items-center justify-center`}
          >
            <AlertTriangle className="h-16 w-16 mb-4" />
            {holding ? (
              <div className="text-6xl font-bold">{countdown}</div>
            ) : (
              <div>HOLD FOR SOS</div>
            )}
          </button>
          <p className="mt-6 text-muted-foreground text-center max-w-md">
            Hold the button for 2 seconds to trigger an emergency alert. Your location will be sent to operations.
          </p>
        </div>
      ) : (
        <div className="glass-card p-6 rounded-xl">
          <h2 className="font-heading text-xl font-semibold mb-4">Emergency Details</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Hazard Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['accident', 'medical', 'robbery', 'breakdown', 'other'] as Hazard[]).map((h) => (
                <button
                  key={h}
                  onClick={() => setHazard(h)}
                  className={`px-4 py-2 rounded-lg border-2 transition ${
                    hazard === h
                      ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'border-border hover:border-red-500/50'
                  }`}
                >
                  {h.charAt(0).toUpperCase() + h.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Photo Evidence (Optional)</label>
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full max-h-48 object-cover rounded-lg"
                />
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
                  className="flex-1"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Gallery
                </Button>
              </div>
            )}
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

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Additional Note (Optional)</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the situation..."
              rows={3}
            />
          </div>

          {location && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={submitSOS}
              disabled={submitting || !location || uploadingPhoto}
              className="flex-1"
              variant="destructive"
            >
              {submitting || uploadingPhoto ? 'Sending...' : 'Send SOS'}
            </Button>
            <Button
              onClick={() => {
                setShowForm(false);
                removePhoto();
              }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
