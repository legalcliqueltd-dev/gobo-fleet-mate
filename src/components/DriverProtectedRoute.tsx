import { Navigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { Loader2 } from 'lucide-react';

/**
 * Protected route for driver app pages.
 * Only checks for driver session in localStorage - no Supabase auth required.
 * Does NOT show PaymentWall (drivers don't pay, admins do).
 */
export default function DriverProtectedRoute({ children }: { children: JSX.Element }) {
  const { isConnected, loading } = useDriverSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/app/connect" replace />;
  }

  return children;
}
