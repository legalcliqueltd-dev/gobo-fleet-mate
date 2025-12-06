import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, QrCode, Link2 } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  imei: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function AddDevice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectionCode, setConnectionCode] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', imei: '' },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setErrorMsg(null);
    
    // Generate connection code
    const { data: codeData, error: codeError } = await supabase.rpc('generate_connection_code');
    
    if (codeError) {
      setErrorMsg('Failed to generate connection code');
      return;
    }

    const { data, error } = await supabase
      .from('devices')
      .insert([{ 
        user_id: user.id, 
        name: values.name, 
        imei: values.imei || null, 
        status: 'offline',
        connection_code: codeData
      }])
      .select()
      .single();
    
    if (error) {
      setErrorMsg(error.message);
    } else if (data) {
      setConnectionCode(data.connection_code);
      setDeviceName(data.name);
      toast.success('Device created! Share the connection code with your driver.');
    }
  };

  const copyCode = () => {
    if (connectionCode) {
      navigator.clipboard.writeText(connectionCode);
      setCopied(true);
      toast.success('Connection code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = () => {
    if (connectionCode) {
      const link = `${window.location.origin}/driver/connect?code=${connectionCode}`;
      navigator.clipboard.writeText(link);
      toast.success('Connection link copied!');
    }
  };

  if (connectionCode) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h2 className="font-heading text-2xl font-semibold mb-6">Device Created Successfully!</h2>
        
        <Card className="mb-6 bg-background/50 backdrop-blur border border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Device: {deviceName}</h3>
              <p className="text-sm text-muted-foreground">
                Share this connection code with your driver to link their app to this device.
              </p>
            </div>

            <div className="bg-background/50 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Connection Code</p>
              <p className="text-4xl font-bold tracking-wider font-mono mb-4">{connectionCode}</p>
              
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={copyCode}
                  variant="outline"
                  size="sm"
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
                
                <Button
                  onClick={copyLink}
                  variant="outline"
                  size="sm"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Instructions for Driver:</h4>
              <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
                <li>Open the Driver App</li>
                <li>Go to Settings or Connection</li>
                <li>Enter this connection code</li>
                <li>Start tracking to sync location with admin</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="default"
          >
            Go to Dashboard
          </Button>
          <Button
            onClick={() => {
              setConnectionCode(null);
              setDeviceName('');
            }}
            variant="outline"
          >
            Create Another Device
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="font-heading text-2xl font-semibold mb-4">Add Device</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 nb-card p-6">
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input 
            className="w-full rounded-lg border-2 border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-cyan-500 dark:focus:border-cyan-500 transition" 
            {...register('name')} 
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">IMEI (optional)</label>
          <input 
            className="w-full rounded-lg border-2 border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-cyan-500 dark:focus:border-cyan-500 transition" 
            {...register('imei')} 
          />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex items-center gap-2">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="nb-button hover:shadow-brutal disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'Saving…' : 'Create device'}
          </button>
        </div>
      </form>
    </div>
  );
}
