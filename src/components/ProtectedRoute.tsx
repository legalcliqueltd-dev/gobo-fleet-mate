import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PaymentWall from './PaymentWall';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading, subscription } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Checking session...
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirect=${redirect}`} replace />;
  }

  // Show payment wall if trial expired
  if (subscription.status === 'expired') {
    return <PaymentWall />;
  }

  return children;
}
