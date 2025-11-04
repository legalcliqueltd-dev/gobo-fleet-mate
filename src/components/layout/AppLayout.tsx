import { Link } from 'react-router-dom';
import { Truck, LayoutDashboard, MapPin, Users, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl">FleetTrackMate</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/app/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link to="/app/fleet" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <MapPin className="w-4 h-4" />
              Fleet
            </Link>
            <Link to="/app/drivers" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Users className="w-4 h-4" />
              Drivers
            </Link>
            <Link to="/app/settings" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
