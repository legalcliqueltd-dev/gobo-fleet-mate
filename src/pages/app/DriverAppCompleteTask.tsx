import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Camera, X, CheckCircle2, MapPin, Loader2, Video, FileWarning, Play } from 'lucide-react';
import { toast } from 'sonner';
import { isNativePlatform, capturePhotoAsFile } from '@/utils/nativeCamera';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type Task = {
  id: string;
  title: string;
  description: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  admin_code: string | null;
};

type MediaFile = {
  file: File;
  url: string;
  type: 'image' | 'video';
};

export default function DriverAppCompleteTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
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

  const handleMediaCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    processFiles(Array.from(files));
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = (files: File[]) => {
    const newFiles: MediaFile[] = [];
    
    files.forEach(file => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large. Maximum 5MB allowed.`);
        return;
      }

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        toast.error(`${file.name} is not a supported format.`);
        return;
      }

      const url = URL.createObjectURL(file);
      newFiles.push({
        file,
        url,
        type: isVideo ? 'video' : 'image',
      });
    });

    setMediaFiles(prev => [...prev, ...newFiles]);
  };

  const handleNativeCameraCapture = async () => {
    if (isNativePlatform()) {
      try {
        const file = await capturePhotoAsFile('camera');
        if (file) {
          processFiles([file]);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to capture photo');
      }
    } else {
      // Fallback to HTML input for web
      fileInputRef.current?.click();
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadMedia = async (): Promise<string[]> => {
    if (mediaFiles.length === 0) return [];

    const uploadedUrls: string[] = [];
    const totalFiles = mediaFiles.length;

    for (let i = 0; i < mediaFiles.length; i++) {
      const { file } = mediaFiles[i];
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${session?.driverId}/${taskId}/${timestamp}_${i}.${ext}`;

      const { data, error } = await supabase.storage
        .from('proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('proofs')
        .getPublicUrl(data.path);

      uploadedUrls.push(urlData.publicUrl);
      setUploadProgress(((i + 1) / totalFiles) * 100);
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

    if (mediaFiles.length === 0) {
      toast.error('Please add at least one photo or video as proof');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      // Upload media first
      const uploadedMediaUrls = await uploadMedia();

      // Calculate distance to dropoff
      const distanceToDropoff = calculateDistance();

      // Update task status
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Create task report
      const reportData = {
        task_id: task.id,
        reporter_user_id: '00000000-0000-0000-0000-000000000000', // Placeholder for mobile drivers
        delivered: true,
        photos: uploadedMediaUrls,
        note: notes.trim() || null,
        latitude: currentLocation?.lat || null,
        longitude: currentLocation?.lng || null,
        distance_to_dropoff_m: distanceToDropoff,
        verified_by: 'photo',
      };

      await supabase.from('task_reports').insert(reportData);

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
  const totalSize = mediaFiles.reduce((acc, m) => acc + m.file.size, 0);
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  return (
    <DriverAppLayout>
      <div className="p-4 space-y-4 pb-32">
        <Card className="border-primary/20">
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

        {/* Media Capture */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Proof (Photos/Videos) *
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Max 5MB per file • Photos and short videos accepted
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              capture="environment"
              multiple
              onChange={handleMediaCapture}
              className="hidden"
            />
            
            <Button
              variant="outline"
              className="w-full h-24 border-dashed border-2"
              onClick={handleNativeCameraCapture}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <Video className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Tap to capture photo or video</span>
              </div>
            </Button>

            {/* Media Grid */}
            {mediaFiles.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt={`Proof ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="relative w-full h-full bg-black flex items-center justify-center">
                          <video
                            src={media.url}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {media.type === 'video' && (
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                          VIDEO
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{mediaFiles.length} file{mediaFiles.length > 1 ? 's' : ''}</span>
                  <span className={totalSize > MAX_FILE_SIZE * mediaFiles.length ? 'text-destructive' : ''}>
                    {sizeMB} MB total
                  </span>
                </div>
              </>
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
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading files...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Size Warning */}
        {mediaFiles.some(m => m.file.size > MAX_FILE_SIZE * 0.8) && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
            <FileWarning className="h-4 w-4 flex-shrink-0" />
            <span>Some files are close to the 5MB limit. Consider using lower quality settings.</span>
          </div>
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
              disabled={submitting || mediaFiles.length === 0}
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
