import { forwardRef, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A password field you can read what you typed into.
 *
 * Every password input in this app was a bare `type="password"` with no way to
 * reveal it. On a phone keyboard, with autocorrect off and a mix of cases and
 * symbols, that means the only feedback for a typo is a rejected sign-in
 * afterwards — and on the signup screen, which had no confirmation field
 * either, a typo silently created an account with a password nobody knew.
 *
 * The toggle is a plain button rather than a Radix control because it must not
 * take focus from the field or submit the form it sits inside.
 */
const PasswordInput = forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input> & { showLockIcon?: boolean }
>(function PasswordInput({ className, showLockIcon = true, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {showLockIcon && (
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', showLockIcon && 'pl-10', className)}
        {...props}
      />
      <button
        type="button"
        // Not a real control for assistive tech to land on mid-form; the label
        // announces state instead.
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        // Keeps the caret and the on-screen keyboard exactly where they were.
        onMouseDown={(e) => e.preventDefault()}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export default PasswordInput;
