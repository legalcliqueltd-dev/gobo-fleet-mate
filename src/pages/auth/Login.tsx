import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { user } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const redirectTo = search.get('redirect') || '/dashboard';

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) setErrorMsg(error.message);
    else navigate(redirectTo, { replace: true });
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Log in</h2>
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
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-cyan-600 text-white py-2 hover:bg-cyan-700 disabled:opacity-50">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex items-center justify-between text-sm mt-2">
          <Link to="/auth/forgot" className="text-cyan-700 dark:text-cyan-300 hover:underline">Forgot password?</Link>
          <Link to="/auth/signup" className="hover:underline">Create account</Link>
        </div>
      </form>
    </div>
  );
}
