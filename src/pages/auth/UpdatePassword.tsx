import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PasswordInput from '@/components/admin/PasswordInput';
import { friendlyAuthError } from '@/services/authErrors';

const schema = z
  .object({
    password: z.string().min(6, 'At least 6 characters'),
    confirm: z.string().min(6, 'Re-enter your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

/**
 * Where the website's "reset your password" email lands.
 *
 * Previously hand-rolled `<input>` and `<button>` elements with their own
 * colours, so it looked like a different product from every other screen —
 * which on a page that asks for a password is not merely untidy: an
 * unfamiliar form asking for credentials is what people are told to distrust.
 */
export default function UpdatePassword() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The recovery link establishes the session. Landing here without one means
  // the link expired or was already used, and there is nothing to update.
  useEffect(() => {
    if (!loading && !user) navigate('/auth/login', { replace: true });
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
    setErrorMsg(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setErrorMsg(friendlyAuthError(error, 'update'));
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/20 p-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <h1 className="font-heading text-lg font-semibold">Set a new password</h1>
          </div>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="py-4 text-sm text-muted-foreground">
              Password updated. Taking you to your dashboard…
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="h-11"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  placeholder="Type it again"
                  className="h-11"
                  {...register('confirm')}
                />
                {errors.confirm && (
                  <p className="text-sm text-destructive">{errors.confirm.message}</p>
                )}
              </div>

              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

              <Button type="submit" disabled={isSubmitting} className="h-11 w-full font-semibold">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
