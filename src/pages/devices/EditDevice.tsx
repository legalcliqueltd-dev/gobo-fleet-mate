import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams, Link } from 'react-router-dom';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  imei: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function EditDevice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, imei')
        .eq('id', id)
        .single();
      if (error) setErrorMsg(error.message);
      else if (data) reset({ name: data.name ?? '', imei: data.imei ?? '' });
    };
    load();
  }, [id, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!id) return;
    setErrorMsg(null);
    const { error } = await supabase
      .from('devices')
      .update({ name: values.name, imei: values.imei || null })
      .eq('id', id);
    if (error) setErrorMsg(error.message);
    else navigate(`/devices/${id}`, { replace: true });
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Edit Device</h2>
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
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
          <Link to={`/devices/${id}`} className="rounded-md border px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
