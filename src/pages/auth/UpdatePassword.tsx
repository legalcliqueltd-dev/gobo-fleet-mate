import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const schema = z.object({
  password: z.string().min(6, 'Min 6 characters'),
  confirm: z.string().min(6),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormValues = z.infer<typeof schema>;

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) setErrorMsg(error.message);
    else navigate('/dashboard', { replace: true });
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Set a new password</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white/60 dark:bg-slate-900/50 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input type="password" className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('password')} />
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm new password</label>
          <input type="password" className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('confirm')} />
          {errors.confirm && <p className="text-sm text-red-600 mt-1">{errors.confirm.message}</p>}
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-cyan-600 text-white py-2 hover:bg-cyan-700 disabled:opacity-50">
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
