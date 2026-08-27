import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, MailCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PasswordInput from '@/components/admin/PasswordInput';
import { Label } from '@/components/ui/label';
import AuthScreenShell from '@/components/admin/AuthScreenShell';
import SocialAuthButtons from '@/components/admin/SocialAuthButtons';
import AuthDivider from '@/components/admin/AuthDivider';
import FormError from '@/components/admin/FormError';
import { signUpWithEmail } from '@/services/adminAuth';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyAuthError } from '@/services/authErrors';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'At least 6 characters'),
    confirm: z.string().min(6, 'Re-enter your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export default function AdminSignup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/app/admin/fleet', { replace: true });
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', password: '', confirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      const { needsConfirmation } = await signUpWithEmail(
        values.email,
        values.password,
        values.fullName
      );
      if (needsConfirmation) setAwaitingConfirmation(values.email);
      else navigate('/app/admin/fleet', { replace: true });
    } catch (err) {
      setErrorMsg(friendlyAuthError(err, 'signup'));
    }
  };

  if (awaitingConfirmation) {
    return (
      <AuthScreenShell
        title="Check your email"
        subtitle="One quick step to finish"
        backTo="/app/admin/login"
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <MailCheck className="h-7 w-7 text-primary" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{awaitingConfirmation}</span>. Open it to
            activate your account, then come back and sign in.
          </p>
          <Button className="h-12 w-full" onClick={() => navigate('/app/admin/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell
      title="Create your account"
      subtitle="Start tracking your fleet in minutes"
      backTo="/app/role"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/app/admin/login" className="font-medium text-primary">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="Ada Okafor"
              className="h-12 pl-10"
              {...register('fullName')}
            />
          </div>
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
        </div>

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
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            className="h-12"
            {...register('password')}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder="Type it again"
            className="h-12"
            {...register('confirm')}
          />
          {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
        </div>

        <FormError message={errorMsg} />

        <Button type="submit" disabled={isSubmitting} className="h-12 w-full font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <AuthDivider />
      <SocialAuthButtons onError={setErrorMsg} />

      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        By continuing you agree to our{' '}
        <Link to="/terms" className="underline underline-offset-2">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthScreenShell>
  );
}
