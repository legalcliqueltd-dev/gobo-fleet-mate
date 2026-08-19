import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthScreenShell from '@/components/admin/AuthScreenShell';
import FormError from '@/components/admin/FormError';
import { sendPasswordReset } from '@/services/adminAuth';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormValues = z.infer<typeof schema>;

export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    try {
      await sendPasswordReset(values.email);
      setSentTo(values.email);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send the reset link.');
    }
  };

  if (sentTo) {
    return (
      <AuthScreenShell title="Reset link sent" subtitle="Check your inbox" backTo="/app/admin/login">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <MailCheck className="h-7 w-7 text-primary" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If an account exists for{' '}
            <span className="font-medium text-foreground">{sentTo}</span>, we've sent it a link to
            set a new password.
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
      title="Forgot password"
      subtitle="We'll email you a reset link"
      backTo="/app/admin/login"
      footer={
        <>
          Remembered it?{' '}
          <Link to="/app/admin/login" className="font-medium text-primary">
            Sign in
          </Link>
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

        <FormError message={errorMsg} />

        <Button type="submit" disabled={isSubmitting} className="h-12 w-full font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>
    </AuthScreenShell>
  );
}
