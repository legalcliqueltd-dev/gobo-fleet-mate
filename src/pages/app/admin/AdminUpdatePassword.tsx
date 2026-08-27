import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthScreenShell from '@/components/admin/AuthScreenShell';
import FormError from '@/components/admin/FormError';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const schema = z
  .object({
    password: z.string().min(6, 'At least 6 characters'),
    confirm: z.string().min(6, 'At least 6 characters'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

/**
 * Where a "reset your password" email lands inside the native app.
 *
 * The link signs the account in as a side effect, which is exactly why this
 * screen has to exist: without it the manager is dropped on the fleet map
 * looking signed in, with the password they came to change still unchanged
 * and no route back to changing it.
 *
 * The web build has its own version of this screen at /auth/update-password;
 * that one is not reused because it navigates to /dashboard, a route the
 * native bundle does not contain.
 */
export default function AdminUpdatePassword() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');

  // The recovery link is what establishes the session. Arriving here without
  // one (a stale tab, a link opened twice) means there is nothing to update.
  useEffect(() => {
    if (!loading && !user) navigate('/app/admin/login', { replace: true });
  }, [loading, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    navigate('/app/admin/fleet', { replace: true });
  };

  return (
    <AuthScreenShell
      title="Set a new password"
      subtitle="Then you're back in"
      backTo="/app/admin/login"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="h-12 pl-10"
              {...register('password')}
            />
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Type it again"
              className="h-12 pl-10"
              {...register('confirm')}
            />
          </div>
          {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
        </div>

        <FormError message={errorMsg} />

        <Button type="submit" disabled={isSubmitting} className="h-12 w-full font-semibold">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save password'
          )}
        </Button>
      </form>
    </AuthScreenShell>
  );
}
