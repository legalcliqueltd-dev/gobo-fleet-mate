import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEYS = {
  DRIVER_ID: 'ftm_driver_id',
  DRIVER_NAME: 'ftm_driver_name',
  ADMIN_CODE: 'ftm_admin_code',
};

interface DriverSession {
  driverId: string;
  driverName: string;
  adminCode: string;
}

interface DriverSessionContextType {
  session: DriverSession | null;
  loading: boolean;
  connect: (driverId: string, driverName: string, adminCode: string) => void;
  disconnect: () => void;
  isConnected: boolean;
}

const DriverSessionContext = createContext<DriverSessionContextType | undefined>(undefined);

export function DriverSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DriverSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const driverId = localStorage.getItem(STORAGE_KEYS.DRIVER_ID);
    const driverName = localStorage.getItem(STORAGE_KEYS.DRIVER_NAME);
    const adminCode = localStorage.getItem(STORAGE_KEYS.ADMIN_CODE);

    if (driverId && driverName && adminCode) {
      setSession({ driverId, driverName, adminCode });
    }
    setLoading(false);
  }, []);

  const connect = useCallback((driverId: string, driverName: string, adminCode: string) => {
    localStorage.setItem(STORAGE_KEYS.DRIVER_ID, driverId);
    localStorage.setItem(STORAGE_KEYS.DRIVER_NAME, driverName);
    localStorage.setItem(STORAGE_KEYS.ADMIN_CODE, adminCode);
    setSession({ driverId, driverName, adminCode });
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.DRIVER_ID);
    localStorage.removeItem(STORAGE_KEYS.DRIVER_NAME);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_CODE);
    setSession(null);
  }, []);

  return (
    <DriverSessionContext.Provider
      value={{
        session,
        loading,
        connect,
        disconnect,
        isConnected: !!session,
      }}
    >
      {children}
    </DriverSessionContext.Provider>
  );
}

export function useDriverSession() {
  const context = useContext(DriverSessionContext);
  if (context === undefined) {
    throw new Error('useDriverSession must be used within a DriverSessionProvider');
  }
  return context;
}
