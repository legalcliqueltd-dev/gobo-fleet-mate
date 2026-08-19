import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthScreenShell from '@/components/admin/AuthScreenShell';
import SocialAuthButtons from '@/components/admin/SocialAuthButtons';
import AuthDivider from '@/components/admin/AuthDivider';
import FormError from '@/components/admin/FormError';
import SwitchModeLink from '@/components/SwitchModeLink';
import { signInWithEmail } from '@/services/adminAuth';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function AdminLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');

  // Covers both the email form and a social sign-in completing asynchronously.
  useEffect(() => {
    if (user) navigate('/app/admin/fleet', { replace: true });
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      await signInWithEmail(values.email, values.password);
      navigate('/app/admin/fleet', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not sign in.');
    }
  };

  return (
    <AuthScreenShell
      title="Welcome back"
      subtitle="Sign in to manage your fleet"
      backTo="/app/role"
      footer={
        <>
          <p>
            New to FleetTrackMate?{' '}
            <Link to="/app/admin/signup" className="font-medium text-primary">
              Create an account
            </Link>
          </p>
          <SwitchModeLink to="driver" />
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="you@company.com"
              className="h-12 pl-10"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/app/admin/forgot" className="text-xs font-medium text-primary">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-12 pl-10"
              {...register('password')}
            />
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <FormError message={errorMsg} />

        <Button type="submit" disabled={isSubmitting} className="h-12 w-full font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <AuthDivider />
      <SocialAuthButtons onError={setErrorMsg} />
    </AuthScreenShell>
  );
}
