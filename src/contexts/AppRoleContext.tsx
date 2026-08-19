import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

/**
 * Which face of the app the user is currently using.
 *
 * The native bundle ships both the driver app (code-based session, no email)
 * and the admin portal (Supabase email / Google / Apple auth). This context
 * remembers which one the user picked so the app opens straight into it on
 * every subsequent launch, while still allowing a switch from either
 * Settings screen.
 */
export type AppRole = 'driver' | 'admin';

const STORAGE_KEY = 'ftm_app_role';

type AppRoleContextType = {
  role: AppRole | null;
  /** False only for the very first frame, while localStorage is read. */
  ready: boolean;
  chooseRole: (role: AppRole) => void;
  /** Send the user back to the role picker (used by "Switch mode"). */
  clearRole: () => void;
};

const AppRoleContext = createContext<AppRoleContextType | undefined>(undefined);

function readStoredRole(): AppRole | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'driver' || stored === 'admin' ? stored : null;
  } catch {
    return null;
  }
}

export function AppRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(readStoredRole());
    setReady(true);
  }, []);

  const chooseRole = useCallback((next: AppRole) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — role simply won't persist across launches */
    }
    setRole(next);
  }, []);

  const clearRole = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setRole(null);
  }, []);

  return (
    <AppRoleContext.Provider value={{ role, ready, chooseRole, clearRole }}>
      {children}
    </AppRoleContext.Provider>
  );
}

export function useAppRole() {
  const ctx = useContext(AppRoleContext);
  if (!ctx) throw new Error('useAppRole must be used within AppRoleProvider');
  return ctx;
}
