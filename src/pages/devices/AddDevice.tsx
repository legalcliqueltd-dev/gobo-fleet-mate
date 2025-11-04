import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  imei: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function AddDevice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', imei: '' },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('devices')
      .insert([{ user_id: user.id, name: values.name, imei: values.imei || null, status: 'active' }])
      .select()
      .single();
    if (error) {
      setErrorMsg(error.message);
    } else if (data) {
      navigate(`/devices/${data.id}`, { replace: true });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Add Device</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white/60 dark:bg-slate-900/50 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('name')} />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IMEI (optional)</label>
          <input className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('imei')} />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={isSubmitting} className="rounded-md bg-cyan-600 text-white px-4 py-2 hover:bg-cyan-700 disabled:opacity-50">
            {isSubmitting ? 'Saving…' : 'Create device'}
          </button>
        </div>
      </form>
    </div>
  );
}
