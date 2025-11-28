import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, CheckCircle, QrCode, Hash, MapPin, FileText } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import QrScanner from 'react-qr-scanner';

type Task = {
  id: string;
  title: string;
  description: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_radius_m: number;
  qr_secret: string | null;
  status: string;
};

export default function CompleteTask() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const signatureRef = useRef<SignatureCanvas>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'verify' | 'capture' | 'submit'>('verify');

  // Verification
  const [verifyMethod, setVerifyMethod] = useState<'qr' | 'otp' | 'geofence'>('geofence');
  const [otpCode, setOtpCode] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedBy, setVerifiedBy] = useState<string>('none');

  // Location
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceToDropoff, setDistanceToDropoff] = useState<number | null>(null);

  // Capture
  const [photos, setPhotos] = useState<File[]>([]);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTask();
    getCurrentLocation();
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !data) {
      toast.error('Task not found');
      navigate('/driver/tasks');
      return;
    }

    setTask(data);
    setLoading(false);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          if (task?.dropoff_lat && task?.dropoff_lng) {
            const distance = calculateDistance(
              loc.lat,
              loc.lng,
              task.dropoff_lat,
              task.dropoff_lng
            );
            setDistanceToDropoff(distance);
          }
        },
        (err) => {
          console.error('Location error:', err);
          toast.error('Could not get your location');
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || !taskId) {
      toast.error('Please enter OTP code');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('pod-otp', {
        body: { action: 'verify', taskId, otp: otpCode },
      });

      if (error) throw error;

      if (data.verified) {
        setVerified(true);
        setVerifiedBy('otp');
        toast.success('OTP verified successfully');
        setStep('capture');
      } else {
        toast.error('Invalid or expired OTP');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify OTP');
    }
  };

  const handleQrScan = (data: any) => {
    if (data) {
      try {
        const payload = JSON.parse(data.text);
        if (payload.task_id === taskId && payload.qr_secret === task?.qr_secret) {
          setVerified(true);
          setVerifiedBy('qr');
          setShowQrScanner(false);
          toast.success('QR code verified');
          setStep('capture');
        } else {
          toast.error('Invalid QR code');
        }
      } catch (err) {
        toast.error('Invalid QR code format');
      }
    }
  };

  const handleGeofenceVerify = () => {
    if (!distanceToDropoff || !task) {
      toast.error('Location unavailable');
      return;
    }

    if (distanceToDropoff <= task.dropoff_radius_m) {
      setVerified(true);
      setVerifiedBy('geofence');
      toast.success('Location verified');
      setStep('capture');
    } else {
      toast.error(
        `You are ${(distanceToDropoff / 1000).toFixed(2)} km away. Must be within ${
          task.dropoff_radius_m
        }m`
      );
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotos([...photos, ...files]);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('proofs').upload(path, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage.from('proofs').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user || !task || !location) {
      toast.error('Missing required information');
      return;
    }

    if (!receiverName) {
      toast.error('Receiver name is required');
      return;
    }

    setSubmitting(true);

    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const path = `${user.id}/${taskId}/${Date.now()}_${photo.name}`;
        const url = await uploadFile(photo, path);
        if (url) photoUrls.push(url);
      }

      // Upload signature
      let signatureUrl: string | null = null;
      if (signatureRef.current && !signatureRef.current.isEmpty()) {
        const signatureBlob = await fetch(
          signatureRef.current.toDataURL()
        ).then((res) => res.blob());
        const signatureFile = new File([signatureBlob], 'signature.png', {
          type: 'image/png',
        });
        const path = `${user.id}/${taskId}/signature_${Date.now()}.png`;
        signatureUrl = await uploadFile(signatureFile, path);
      }

      // Create report
      const { error: reportError } = await supabase.from('task_reports').insert({
        task_id: taskId,
        reporter_user_id: user.id,
        delivered: true,
        receiver_name: receiverName,
        receiver_phone: receiverPhone || null,
        verified_by: verifiedBy,
        otp_verified_at: verifiedBy === 'otp' ? new Date().toISOString() : null,
        latitude: location.lat,
        longitude: location.lng,
        distance_to_dropoff_m: distanceToDropoff ? Math.round(distanceToDropoff) : null,
        note: note || null,
        signature_url: signatureUrl,
        photos: photoUrls,
      });

      if (reportError) throw reportError;

      // Update task status
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'delivered' })
        .eq('id', taskId);

      if (taskError) throw taskError;

      toast.success('Task completed successfully!');
      navigate('/driver/tasks');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete task');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !task) {
    return <div className="max-w-2xl mx-auto p-4">Loading task...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Complete Task: {task.title}</h1>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {['verify', 'capture', 'submit'].map((s, idx) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : idx < ['verify', 'capture', 'submit'].indexOf(step)
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {idx + 1}
            </div>
            {idx < 2 && <div className="flex-1 h-1 bg-muted mx-2" />}
          </div>
        ))}
      </div>

      {/* Step: Verify */}
      {step === 'verify' && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Step 1: Verify Delivery Location</h2>

          {location && distanceToDropoff !== null && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                <span>
                  Distance to dropoff: <strong>{(distanceToDropoff / 1000).toFixed(2)} km</strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Required: within {task.dropoff_radius_m}m
              </p>
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
              <input
                type="radio"
                name="verify"
                checked={verifyMethod === 'geofence'}
                onChange={() => setVerifyMethod('geofence')}
              />
              <MapPin className="h-5 w-5" />
              <div>
                <div className="font-medium">Geofence Verification</div>
                <div className="text-sm text-muted-foreground">Verify by location proximity</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
              <input
                type="radio"
                name="verify"
                checked={verifyMethod === 'otp'}
                onChange={() => setVerifyMethod('otp')}
              />
              <Hash className="h-5 w-5" />
              <div>
                <div className="font-medium">OTP Code</div>
                <div className="text-sm text-muted-foreground">
                  Enter code provided by receiver
                </div>
              </div>
            </label>

            {task.qr_secret && (
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="verify"
                  checked={verifyMethod === 'qr'}
                  onChange={() => setVerifyMethod('qr')}
                />
                <QrCode className="h-5 w-5" />
                <div>
                  <div className="font-medium">Scan QR Code</div>
                  <div className="text-sm text-muted-foreground">
                    Scan receiver's QR code
                  </div>
                </div>
              </label>
            )}
          </div>

          {verifyMethod === 'otp' && (
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
              />
              <Button onClick={handleVerifyOTP} className="w-full">
                Verify OTP
              </Button>
            </div>
          )}

          {verifyMethod === 'qr' && (
            <div className="space-y-3">
              {!showQrScanner ? (
                <Button onClick={() => setShowQrScanner(true)} className="w-full">
                  <QrCode className="h-4 w-4 mr-2" />
                  Open QR Scanner
                </Button>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <QrScanner
                    delay={300}
                    onError={(err) => console.error(err)}
                    onScan={handleQrScan}
                    style={{ width: '100%' }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowQrScanner(false)}
                    className="w-full mt-2"
                  >
                    Close Scanner
                  </Button>
                </div>
              )}
            </div>
          )}

          {verifyMethod === 'geofence' && (
            <Button onClick={handleGeofenceVerify} className="w-full">
              Verify Location
            </Button>
          )}
        </div>
      )}

      {/* Step: Capture */}
      {step === 'capture' && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Step 2: Capture Proof of Delivery</h2>

          <div>
            <label className="block text-sm font-medium mb-2">Receiver Name *</label>
            <Input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Full name of receiver"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Receiver Phone</label>
            <Input
              type="tel"
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handlePhotoCapture}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {photos.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">{photos.length} photo(s) selected</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Signature</label>
            <div className="border rounded-lg overflow-hidden bg-background">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'w-full h-40',
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signatureRef.current?.clear()}
              className="mt-2"
            >
              Clear Signature
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Notes</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          <Button onClick={() => setStep('submit')} className="w-full">
            Continue to Submit
          </Button>
        </div>
      )}

      {/* Step: Submit */}
      {step === 'submit' && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Step 3: Review & Submit</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified by:</span>
              <span className="font-medium">{verifiedBy.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receiver:</span>
              <span className="font-medium">{receiverName}</span>
            </div>
            {receiverPhone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{receiverPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Photos:</span>
              <span className="font-medium">{photos.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Signature:</span>
              <span className="font-medium">
                {signatureRef.current && !signatureRef.current.isEmpty() ? 'Yes' : 'No'}
              </span>
            </div>
            {location && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('capture')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? 'Submitting...' : 'Complete Task'}
              <CheckCircle className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
