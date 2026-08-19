import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.webp';

type AuthScreenShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Where the back arrow goes. Omit to hide it. */
  backTo?: string;
  footer?: ReactNode;
};

/**
 * Shared frame for the admin sign-in / sign-up / reset screens so all three
 * share one rhythm: safe-area aware, brand mark, generous heading, then a
 * single card of controls sized for thumbs (48px targets throughout).
 */
export default function AuthScreenShell({
  title,
  subtitle,
  children,
  backTo,
  footer,
}: AuthScreenShellProps) {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {backTo && (
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center px-6 py-6">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src={logo} alt="" className="mb-4 h-12 w-12 rounded-xl" />
            <p className="eyebrow mb-2">Manager portal</p>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div
            className="rounded-2xl border border-border bg-card p-5"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
