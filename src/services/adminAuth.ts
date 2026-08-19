import { supabase } from '@/integrations/supabase/client';
import { detectNativePlatform, isIOS } from '@/utils/platformDetection';

/**
 * Admin authentication for the native app.
 *
 * The admin portal uses the same Supabase identities as the website, so a
 * manager who signed up on fleettrackmate.com can sign straight into the app
 * and vice versa. Three routes in:
 *
 *   • Email + password  — always available, no external setup.
 *   • Google            — native account sheet via @capgo/capacitor-social-login,
 *                         falling back to the website's browser OAuth flow.
 *   • Apple             — same, and REQUIRED on iOS by App Store guideline 4.8
 *                         because we also offer Google.
 *
 * The native path exchanges the provider's identity token for a Supabase
 * session with `signInWithIdToken`, which keeps the user inside the app (no
 * browser bounce). It only engages when the matching client IDs are
 * configured; otherwise we transparently use the browser flow so the app is
 * never left without a working sign-in.
 */

export type SocialProvider = 'google' | 'apple';

/** Custom scheme registered in the Android manifest and iOS Info.plist. */
export const AUTH_DEEP_LINK = 'fleettrackmate://auth/callback';

const env = import.meta.env as Record<string, string | undefined>;

const GOOGLE_WEB_CLIENT_ID = env.VITE_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = env.VITE_GOOGLE_IOS_CLIENT_ID ?? '';
/** Apple "Services ID" — only needed for the Android/web Apple flow. */
const APPLE_SERVICE_ID = env.VITE_APPLE_SERVICE_ID ?? '';
const APPLE_REDIRECT_URL = env.VITE_APPLE_REDIRECT_URL ?? '';

/**
 * True when the native SDK for this provider has the credentials it needs.
 * iOS Sign in with Apple is built into the OS and needs no client ID, so it
 * is always considered configured there.
 */
export function isNativeProviderConfigured(provider: SocialProvider): boolean {
  if (!detectNativePlatform()) return false;
  if (provider === 'google') {
    return Boolean(GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID);
  }
  return isIOS() ? true : Boolean(APPLE_SERVICE_ID && APPLE_REDIRECT_URL);
}

type SocialLoginPlugin = {
  initialize: (options: Record<string, unknown>) => Promise<void>;
  login: (options: { provider: string; options: Record<string, unknown> }) => Promise<{
    provider: string;
    result: { idToken?: string | null; responseType?: string };
  }>;
  logout: (options: { provider: string }) => Promise<void>;
};

/**
 * The plugin is handed around inside a box rather than on its own.
 *
 * Capacitor's plugin handle is a Proxy that answers *any* property access with
 * a callable, `then` included. That makes it look like a thenable, so resolving
 * a promise with it directly sends the JS runtime down the promise-assimilation
 * path: it calls `SocialLogin.then(resolve, reject)`, the bridge forwards that
 * to the native layer as a method named `then`, and the whole sign-in dies with
 *
 *     "SocialLogin.then()" is not implemented on ios [code: UNIMPLEMENTED]
 *
 * Wrapping it in a plain object means promise resolution never inspects the
 * proxy. Note this applies to `return plugin` from an async function too — that
 * value goes through Promise.resolve() and would assimilate exactly the same
 * way, which is why `loadPlugin` is deliberately not async and hands back the
 * box for callers to destructure.
 */
type PluginBox = { plugin: SocialLoginPlugin | null };

let pluginPromise: Promise<PluginBox> | null = null;
let initialized = false;

/**
 * Load the social-login plugin lazily. Kept out of the initial chunk so the
 * website bundle never pays for it, and tolerant of the plugin being absent
 * (e.g. a web preview build) rather than crashing the sign-in screen.
 */
function loadPlugin(): Promise<PluginBox> {
  if (!pluginPromise) {
    pluginPromise = import('@capgo/capacitor-social-login')
      .then((mod) => ({ plugin: (mod?.SocialLogin as unknown as SocialLoginPlugin) ?? null }))
      .catch((err) => {
        console.warn('[adminAuth] social-login plugin unavailable:', err);
        return { plugin: null };
      });
  }
  return pluginPromise;
}

async function ensureInitialized(plugin: SocialLoginPlugin): Promise<void> {
  if (initialized) return;

  const options: Record<string, unknown> = {};

  if (GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID) {
    options.google = {
      webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
      iOSClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      mode: 'online',
    };
  }

  if (APPLE_SERVICE_ID && APPLE_REDIRECT_URL) {
    options.apple = { clientId: APPLE_SERVICE_ID, redirectUrl: APPLE_REDIRECT_URL };
  } else if (isIOS()) {
    options.apple = {};
  }

  await plugin.initialize(options);
  initialized = true;
}

/**
 * Native provider sign-in. Returns true when a Supabase session was
 * established; false means "not available here, use the browser flow".
 * Throws only when the native sheet itself reported a real failure.
 */
async function signInNatively(provider: SocialProvider): Promise<boolean> {
  if (!isNativeProviderConfigured(provider)) return false;

  const { plugin } = await loadPlugin();
  if (!plugin) return false;

  await ensureInitialized(plugin);

  const { result } = await plugin.login({
    provider,
    options: provider === 'google' ? { scopes: ['profile', 'email'] } : { scopes: ['name', 'email'] },
  });

  const idToken = result?.idToken;
  if (!idToken) {
    throw new Error(`${provider === 'google' ? 'Google' : 'Apple'} did not return an identity token.`);
  }

  const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken });
  if (error) throw error;

  return true;
}

/**
 * Browser OAuth fallback. On native we deliberately skip the automatic
 * redirect and open the provider in the system browser, then come back
 * through the `fleettrackmate://` deep link handled below — an in-app
 * webview would be rejected by Google's OAuth policy.
 */
async function signInViaBrowser(provider: SocialProvider): Promise<void> {
  const native = detectNativePlatform();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: native ? AUTH_DEEP_LINK : `${window.location.origin}/app/admin`,
      skipBrowserRedirect: native,
    },
  });

  if (error) throw error;

  if (native && data?.url) {
    window.open(data.url, '_system');
  }
}

/** Sign in with Google or Apple, preferring the native account sheet. */
export async function signInWithProvider(provider: SocialProvider): Promise<void> {
  try {
    if (await signInNatively(provider)) return;
  } catch (err) {
    console.warn(`[adminAuth] native ${provider} sign-in failed, falling back to browser:`, err);
  }
  await signInViaBrowser(provider);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: detectNativePlatform() ? AUTH_DEEP_LINK : `${window.location.origin}/dashboard`,
    },
  });
  if (error) throw error;

  // Supabase returns a user without a session when email confirmation is on.
  return { needsConfirmation: Boolean(data.user && !data.session) };
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: detectNativePlatform()
      ? AUTH_DEEP_LINK
      : `${window.location.origin}/auth/update-password`,
  });
  if (error) throw error;
}

export async function signOutAdmin(): Promise<void> {
  const plugin = initialized ? (await loadPlugin()).plugin : null;
  if (plugin) {
    // Best effort — clearing the provider cache means the next sign-in shows
    // the account picker instead of silently reusing the last account.
    await Promise.allSettled([
      plugin.logout({ provider: 'google' }),
      plugin.logout({ provider: 'apple' }),
    ]);
  }
  await supabase.auth.signOut();
}

/**
 * Complete a browser OAuth round trip.
 *
 * Supabase hands the session back either as `?code=` (PKCE) or as tokens in
 * the URL fragment (implicit), depending on the client's flow type, so we
 * accept both shapes.
 */
export async function completeOAuthCallback(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);

    const code = parsed.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return true;
    }

    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return true;
    }
  } catch (err) {
    console.error('[adminAuth] OAuth callback failed:', err);
  }
  return false;
}

/**
 * Listen for the app being reopened by the OAuth deep link. Registered once
 * from the native entry point; returns a cleanup function.
 */
export function registerAuthDeepLinkHandler(): () => void {
  if (!detectNativePlatform()) return () => {};

  let removeListener: (() => void) | null = null;
  let cancelled = false;

  import('@capacitor/app')
    .then(async ({ App }) => {
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        if (url?.startsWith('fleettrackmate://auth')) {
          void completeOAuthCallback(url);
        }
      });
      if (cancelled) handle.remove();
      else removeListener = () => handle.remove();
    })
    .catch((err) => console.warn('[adminAuth] could not attach deep-link listener:', err));

  return () => {
    cancelled = true;
    removeListener?.();
  };
}
