import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, TestTube2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const TestSimulator = () => {
  const navigate = useNavigate();
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [mapboxStatus, setMapboxStatus] = useState<'present' | 'missing'>('missing');

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        // Simple connection test - just check if we can reach Supabase
        const { data, error } = await supabase.auth.getSession();
        setSupabaseStatus(!error ? 'connected' : 'error');
      } catch {
        setSupabaseStatus('error');
      }
    };

    const checkMapbox = () => {
      setMapboxStatus(import.meta.env.VITE_MAPBOX_TOKEN ? 'present' : 'missing');
    };

    checkSupabase();
    checkMapbox();
  }, []);

  const routes = [
    { path: '/', label: 'Landing Page' },
    { path: '/app/dashboard', label: 'Dashboard' },
    { path: '/app/auth/login', label: 'Login' },
    { path: '/app/auth/signup', label: 'Signup' },
    { path: '/app/demo', label: 'Demo' },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <TestTube2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Test Simulator</h1>
            <p className="text-muted-foreground">Phase-by-phase testing utilities</p>
          </div>
        </div>

        {/* Phase 1 Tests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Phase 1: Setup & Integration</CardTitle>
                <CardDescription>Environment and connectivity tests</CardDescription>
              </div>
              <Badge variant="outline">Current Phase</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Supabase Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {supabaseStatus === 'connected' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : supabaseStatus === 'error' ? (
                  <XCircle className="w-5 h-5 text-destructive" />
                ) : (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                <div>
                  <p className="font-medium">Supabase Connection</p>
                  <p className="text-sm text-muted-foreground">
                    {supabaseStatus === 'checking' && 'Testing connection...'}
                    {supabaseStatus === 'connected' && 'Connected successfully'}
                    {supabaseStatus === 'error' && 'Connection failed'}
                  </p>
                </div>
              </div>
              <Badge variant={supabaseStatus === 'connected' ? 'default' : 'destructive'}>
                {supabaseStatus}
              </Badge>
            </div>

            {/* Mapbox Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {mapboxStatus === 'present' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                <div>
                  <p className="font-medium">Mapbox Token</p>
                  <p className="text-sm text-muted-foreground">
                    {mapboxStatus === 'present' ? 'Token configured' : 'Token missing'}
                  </p>
                </div>
              </div>
              <Badge variant={mapboxStatus === 'present' ? 'default' : 'destructive'}>
                {mapboxStatus}
              </Badge>
            </div>

            {/* Environment Variables */}
            <div className="p-4 border rounded-lg space-y-2">
              <p className="font-medium">Environment Variables</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing'}</p>
                <p>VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}</p>
                <p>VITE_MAPBOX_TOKEN: {import.meta.env.VITE_MAPBOX_TOKEN ? '✓ Set' : '✗ Missing'}</p>
              </div>
            </div>

            {/* Route Navigation Tests */}
            <div className="space-y-3">
              <p className="font-medium">Route Navigation Tests</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {routes.map((route) => (
                  <Button
                    key={route.path}
                    variant="outline"
                    className="justify-start"
                    onClick={() => navigate(route.path)}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    {route.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Future Phases - Collapsed */}
        {[2, 3, 4, 5, 6, 7, 8].map((phase) => (
          <Card key={phase} className="opacity-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Phase {phase}</CardTitle>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default TestSimulator;
