import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
  confirm: z.string().min(6),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setInfoMsg(null); setErrorMsg(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    if (data.user && data.session) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setInfoMsg('Success! Check your email to confirm your account.');
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Create your account</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white/60 dark:bg-slate-900/50 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('email')} />
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('password')} />
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm password</label>
          <input type="password" className="w-full rounded-md border px-3 py-2 bg-white/70 dark:bg-slate-800" {...register('confirm')} />
          {errors.confirm && <p className="text-sm text-red-600 mt-1">{errors.confirm.message}</p>}
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {infoMsg && <p className="text-sm text-emerald-600">{infoMsg}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-cyan-600 text-white py-2 hover:bg-cyan-700 disabled:opacity-50">
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </button>
        <div className="text-sm mt-2">
          Already have an account? <Link to="/auth/login" className="hover:underline">Log in</Link>
        </div>
      </form>
    </div>
  );
}
