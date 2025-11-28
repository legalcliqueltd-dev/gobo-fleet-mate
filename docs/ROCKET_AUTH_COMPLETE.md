# Rocket App - Complete Authentication Guide

This guide fixes all authentication issues between the Rocket driver app and the Lovable admin dashboard.

## Quick Reference

| Item | Value |
|------|-------|
| Supabase URL | `https://invbnyxieoyohahqhbir.supabase.co` |
| Supabase Anon Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI` |
| Supabase Callback | `https://invbnyxieoyohahqhbir.supabase.co/auth/v1/callback` |

---

## Step 1: Supabase Dashboard Configuration

### 1.1 Add Redirect URLs

Go to **Supabase Dashboard → Authentication → URL Configuration**

**Site URL:**
```
https://YOUR-ROCKET-APP.rocket.new
```

**Redirect URLs (add ALL of these):**
```
# Rocket App
https://YOUR-ROCKET-APP.rocket.new
https://YOUR-ROCKET-APP.rocket.new/auth/callback
rocket://callback
rocket://auth/callback

# Lovable Admin Dashboard
https://d78756af-7da0-400e-bb46-4b099b10699b.lovableproject.com
https://id-preview--d78756af-7da0-400e-bb46-4b099b10699b.lovable.app

# Development
http://localhost:3000
http://localhost:4000
http://localhost:8080
http://localhost:19006
exp://localhost:19000
```

### 1.2 Verify Google OAuth

Go to **Supabase Dashboard → Authentication → Providers → Google**

Ensure:
- ✅ Google provider is enabled
- ✅ Client ID is set
- ✅ Client Secret is set

In **Google Cloud Console → APIs & Services → Credentials**:
- Authorized redirect URI includes: `https://invbnyxieoyohahqhbir.supabase.co/auth/v1/callback`

---

## Step 2: Single Global Supabase Client (CRITICAL)

**This is the #1 cause of authentication issues.** Create ONE client instance.

### lib/supabase.js

```javascript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://invbnyxieoyohahqhbir.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI';

// ⚠️ CRITICAL: Export single instance - NEVER call createClient() elsewhere
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,        // React Native persistent storage
    autoRefreshToken: true,       // Auto refresh expired tokens
    persistSession: true,         // Persist session across app restarts
    detectSessionInUrl: true,     // Handle OAuth redirects
  },
});

// Helper to get redirect URL based on environment
export const getRedirectUrl = () => {
  // Replace with your actual Rocket app URL
  return 'https://YOUR-ROCKET-APP.rocket.new/auth/callback';
};
```

---

## Step 3: Auth Context Provider

This manages authentication state across the entire app with a SINGLE listener.

### contexts/AuthContext.js

```javascript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    // ⚠️ CRITICAL ORDER: Set up listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('[Auth] Event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setInitialized(true);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []); // Empty deps - only run ONCE

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, initialized, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## Step 4: Authentication Service Functions

### services/auth.js

```javascript
import { supabase, getRedirectUrl } from '../lib/supabase';

// ============================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================

export async function signUpWithEmail(email, password, fullName = '') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getRedirectUrl(),
      data: {
        full_name: fullName,
        role: 'driver',
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// ============================================
// GOOGLE OAUTH AUTHENTICATION
// ============================================

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectUrl(),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ============================================
// PASSWORD RESET
// ============================================

export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectUrl(),
  });

  if (error) throw error;
  return data;
}
```

---

## Step 5: Auth Callback Screen (FIXES WHITE SCREEN)

This screen handles the OAuth redirect and prevents blank pages.

### screens/AuthCallback.js

```javascript
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export function AuthCallback() {
  const navigation = useNavigation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get session from URL (OAuth return)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AuthCallback] Error:', error.message);
          navigation.replace('Login');
          return;
        }

        if (session) {
          console.log('[AuthCallback] Session found:', session.user.email);
          navigation.replace('Dashboard');
        } else {
          console.log('[AuthCallback] No session');
          navigation.replace('Login');
        }
      } catch (err) {
        console.error('[AuthCallback] Exception:', err);
        navigation.replace('Login');
      }
    };

    // Small delay to ensure URL params are processed
    const timeout = setTimeout(handleCallback, 100);
    return () => clearTimeout(timeout);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#06b6d4" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
  },
});
```

---

## Step 6: Protected Route Component

Guards routes and shows loading state to prevent white screens.

### components/ProtectedRoute.js

```javascript
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children, fallback }) {
  const { user, loading, initialized } = useAuth();

  // ⚠️ CRITICAL: Show loading while initializing
  if (loading || !initialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
        <Text style={styles.text}>Checking authentication...</Text>
      </View>
    );
  }

  // Only redirect AFTER fully initialized
  if (!user) {
    return fallback || null;
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
  },
});
```

---

## Step 7: App Entry Point

### App.js

```javascript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { AuthCallback } from './screens/AuthCallback';

const Stack = createStackNavigator();

function AppNavigator() {
  const { user, loading, initialized } = useAuth();

  // ⚠️ CRITICAL: Don't render routes until auth is initialized
  if (!initialized || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // ✅ Authenticated routes
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      ) : (
        // ✅ Unauthenticated routes
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      )}
      {/* Always available - handles OAuth callback */}
      <Stack.Screen name="AuthCallback" component={AuthCallback} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
```

---

## Step 8: Complete Login Screen

### screens/LoginScreen.js

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { signInWithEmail, signInWithGoogle } from '../services/auth';
import { useNavigation } from '@react-navigation/native';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signInWithEmail(email, password);
      // Auth state change handles navigation automatically
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
      // Redirects to Google, then back to callback
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Driver Login</Text>
        <Text style={styles.subtitle}>Sign in to start tracking</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleEmailLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    color: '#f8fafc',
    fontSize: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#06b6d4',
  },
  googleButton: {
    backgroundColor: '#4285f4',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    marginHorizontal: 12,
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  linkBold: {
    color: '#06b6d4',
    fontWeight: '600',
  },
});
```

---

## Troubleshooting

### White/Blank Screen After Login

**Cause:** Session not loaded before rendering routes.

**Fix:** Ensure `loading` and `initialized` states are checked:
```javascript
if (!initialized || loading) {
  return <LoadingScreen />;
}
```

### "Invalid Redirect URL" Error

**Cause:** Rocket app URL not in Supabase redirect list.

**Fix:** Add your Rocket URL to Supabase → Authentication → URL Configuration.

### Google Login Opens But Doesn't Complete

**Cause:** Missing or incorrect `redirectTo` parameter.

**Fix:** Ensure `signInWithOAuth` includes:
```javascript
options: {
  redirectTo: 'https://YOUR-ROCKET-APP.rocket.new/auth/callback'
}
```

### Session Lost on App Restart

**Cause:** AsyncStorage not configured.

**Fix:** Ensure Supabase client uses:
```javascript
auth: {
  storage: AsyncStorage,
  persistSession: true,
}
```

### Multiple Auth Listeners Causing Issues

**Cause:** `onAuthStateChange` called multiple times.

**Fix:** Use AuthContext pattern with single listener and cleanup:
```javascript
return () => subscription?.unsubscribe();
```

---

## Verification Checklist

- [ ] Single Supabase client instance in `lib/supabase.js`
- [ ] AuthProvider wraps entire app
- [ ] `onAuthStateChange` listener set up BEFORE `getSession()`
- [ ] All screens check `loading` and `initialized` before rendering
- [ ] OAuth `redirectTo` matches URL in Supabase dashboard
- [ ] AuthCallback screen handles OAuth return
- [ ] Rocket app URL added to Supabase redirect URLs
- [ ] Google OAuth credentials configured in Supabase

---

## Support

If issues persist:
1. Check Supabase Auth logs: Dashboard → Authentication → Logs
2. Verify network requests in browser/app dev tools
3. Ensure all URLs are HTTPS in production
