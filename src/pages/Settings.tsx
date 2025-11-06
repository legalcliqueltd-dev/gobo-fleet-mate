import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Bell, Info, Palette } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function Settings() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<{ id: string; token: string; platform: string; created_at: string }[]>([]);

  const loadTokens = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notification_tokens')
      .select('id, token, platform, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setTokens(data ?? []);
  };

  useEffect(() => {
    loadTokens();
  }, [user]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and notification preferences</p>
      </div>

      <Card variant="brutal">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg">Appearance</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card variant="brutal">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg">Notifications</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  In-App Notifications Enabled
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  You're currently receiving real-time in-app notifications for geofence events.
                  Browser push notifications have been disabled to avoid dependency conflicts.
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  To add push notifications, you can use the Supabase edge function approach
                  without Firebase, or implement a webhook-based notification system.
                </p>
              </div>
            </div>
          </div>

          {tokens.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Previous tokens</div>
              <ul className="text-sm space-y-2">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{t.platform}</span>
                    <span>•</span>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="brutal">
        <CardHeader>
          <h3 className="font-heading font-semibold text-lg">Account</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Email: <span className="font-medium text-foreground">{user?.email}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Manage your email and password from the Supabase Auth dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
