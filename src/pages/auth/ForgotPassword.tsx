import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabaseClient';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) setErrorMsg(error.message);
    else setSent(true);
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Reset your password</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white/60 dark:bg-slate-900/50 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('email')} />
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {sent && <p className="text-sm text-emerald-600">If an account exists, a reset link has been sent.</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-cyan-600 text-white py-2 hover:bg-cyan-700 disabled:opacity-50">
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </div>
  );
}
