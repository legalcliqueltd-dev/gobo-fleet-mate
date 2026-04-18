import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  fallback?: string;
  className?: string;
  label?: string;
}

/**
 * Universal back button. Uses browser history when available,
 * falls back to a sensible default route otherwise.
 */
export default function BackButton({ fallback, className, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    // window.history.length > 2 means there's somewhere to go back to
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      const defaultFallback = location.pathname.startsWith('/app')
        ? '/app/dashboard'
        : location.pathname.startsWith('/admin')
        ? '/admin/dashboard'
        : '/dashboard';
      navigate(fallback || defaultFallback);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Go back"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
        'text-sm font-medium text-muted-foreground hover:text-foreground',
        'hover:bg-muted/50 transition-colors',
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
