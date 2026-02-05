import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Camera, X, Upload, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Task = {
  id: string;
  title: string;
  description: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  admin_code: string | null;
};

export default function DriverAppCompleteTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notes, setNotes] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadTask();
    getCurrentLocation();
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, dropoff_lat, dropoff_lng, admin_code')
      .eq('id', taskId)
      .single();

    if (error) {
      toast.error('Task not found');
      navigate('/app/tasks');
      return;
    }

    setTask(data);
    setLoading(false);
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Could not get location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setPhotos(prev => [...prev, ...newFiles]);
    
    // Create preview URLs
    newFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      setPhotoUrls(prev => [...prev, url]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return [];

    const uploadedUrls: string[] = [];
    const totalPhotos = photos.length;

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const timestamp = Date.now();
      const filePath = `${session?.driverId}/${taskId}/${timestamp}_${file.name}`;

      const { data, error } = await supabase.storage
        .from('proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload photo: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('proofs')
        .getPublicUrl(data.path);

      uploadedUrls.push(urlData.publicUrl);
      setUploadProgress(((i + 1) / totalPhotos) * 100);
    }

    return uploadedUrls;
  };

  const calculateDistance = (): number | null => {
    if (!currentLocation || !task?.dropoff_lat || !task?.dropoff_lng) return null;

    const R = 6371000; // Earth's radius in meters
    const lat1 = currentLocation.lat * Math.PI / 180;
    const lat2 = task.dropoff_lat * Math.PI / 180;
    const dLat = (task.dropoff_lat - currentLocation.lat) * Math.PI / 180;
    const dLon = (task.dropoff_lng - currentLocation.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 + 
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const handleSubmit = async () => {
    if (!task || !session) return;

    if (photos.length === 0) {
      toast.error('Please add at least one photo as proof');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      // Upload photos first
      const uploadedPhotoUrls = await uploadPhotos();

      // Calculate distance to dropoff
      const distanceToDropoff = calculateDistance();

      // Create task report - using a placeholder UUID for reporter_user_id
      // since mobile drivers don't have Supabase auth
      const reportData = {
        task_id: task.id,
        reporter_user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
        delivered: true,
        photos: uploadedPhotoUrls,
        note: notes.trim() || null,
        latitude: currentLocation?.lat || null,
        longitude: currentLocation?.lng || null,
        distance_to_dropoff_m: distanceToDropoff,
        verified_by: 'photo',
      };

      // Insert report via edge function or direct insert
      // For now, update task status directly
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      toast.success('Task completed successfully!');
      navigate('/app/tasks');
    } catch (error: any) {
      console.error('Error completing task:', error);
      toast.error(error.message || 'Failed to complete task');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DriverAppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DriverAppLayout>
    );
  }

  if (!task) {
    return (
      <DriverAppLayout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Task not found</p>
        </div>
      </DriverAppLayout>
    );
  }

  const distance = calculateDistance();

  return (
    <DriverAppLayout>
      <div className="p-4 space-y-4 pb-24">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{task.title}</CardTitle>
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
          </CardHeader>
          <CardContent>
            {distance !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`} from dropoff</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photo Capture */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Proof Photos *
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoCapture}
              className="hidden"
            />
            
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to take photo</span>
              </div>
            </Button>

            {/* Photo Grid */}
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                    <img
                      src={url}
                      alt={`Proof ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any notes about the delivery..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Upload Progress */}
        {submitting && uploadProgress > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading photos...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
          <div className="flex gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/app/tasks')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || photos.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Task
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DriverAppLayout>
  );
}
