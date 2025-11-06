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
