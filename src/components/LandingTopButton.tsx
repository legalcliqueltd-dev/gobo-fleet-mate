import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, LogIn } from 'lucide-react';

/**
 * Single floating top-right button on the Landing page.
 * Replaces the full nav bar.
 */
export default function LandingTopButton() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      {user ? (
        <Link to="/dashboard">
          <Button size="sm" className="shadow-lg">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </Link>
      ) : (
        <Link to="/auth/login">
          <Button size="sm" className="shadow-lg">
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Button>
        </Link>
      )}
    </div>
  );
}
