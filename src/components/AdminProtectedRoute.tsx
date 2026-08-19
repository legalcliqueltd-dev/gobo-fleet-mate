import { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Gate for the native manager portal. Waits for Supabase to restore the
 * persisted session before deciding — without the loading check a signed-in
 * manager would be bounced to the login screen on every cold start.
 */
export default function AdminProtectedRoute({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/app/admin/login" replace />;

  return <>{children}</>;
}
