import { Link } from 'react-router-dom';
import { Truck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AuthLogin = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <Truck className="w-8 h-8 text-primary" />
              <span className="font-bold text-2xl">FleetTrackMate</span>
            </div>
          </div>
          <div className="text-center">
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Authentication coming in Phase 2</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="your@email.com" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" disabled />
          </div>
          
          <Button className="w-full" disabled>
            <Lock className="w-4 h-4 mr-2" />
            Sign In (Coming in Phase 2)
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/app/auth/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>

          <div className="text-center text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthLogin;
