import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { getFcmMessaging } from '../lib/firebase';
import { getToken, deleteToken } from 'firebase/messaging';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Bell } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'enabled' | 'disabled' | 'unsupported'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ id: string; token: string; platform: string; created_at: string }[]>([]);
  const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

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

  const enablePush = async () => {
    setError(null);
    if (!user) return;
    try {
      const messaging = await getFcmMessaging();
      if (!messaging || !vapid) {
        setStatus('unsupported');
        setError('Push notifications not supported in this browser or Firebase not configured');
        return;
      }

      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(messaging, { vapidKey: vapid, serviceWorkerRegistration: reg });

      if (!token) throw new Error('No FCM token returned');

      // Save token (dedupe by unique constraint)
      const { error } = await supabase.from('notification_tokens').upsert(
        {
          user_id: user.id,
          token,
          platform: 'web',
        },
        { onConflict: 'token' }
      );

      if (error) throw error;
      setStatus('enabled');
      await loadTokens();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to enable push');
    }
  };

  const disablePush = async () => {
    setError(null);
    if (!user) return;
    try {
      // delete token from browser and DB
      const messaging = await getFcmMessaging();
      if (messaging) {
        const reg = await navigator.serviceWorker.getRegistration();
        const currentToken = tokens[0]?.token;
        if (currentToken) await deleteToken(messaging);
        if (reg) await reg.unregister();
      }
      if (tokens.length) {
        await supabase
          .from('notification_tokens')
          .delete()
          .in(
            'token',
            tokens.map((t) => t.token)
          );
      }
      setStatus('disabled');
      await loadTokens();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to disable push');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and notification preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Notifications</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enable push notifications to get alerts when a device goes offline.
            Requires HTTPS and browser permission.
          </p>
          <div className="flex gap-2">
            <Button onClick={enablePush}>Enable notifications</Button>
            <Button variant="outline" onClick={disablePush}>
              Disable
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Saved tokens</div>
            {tokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tokens saved</p>
            ) : (
              <ul className="text-sm space-y-2">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{t.platform}</span>
                    <span>•</span>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-lg">Account</h3>
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
